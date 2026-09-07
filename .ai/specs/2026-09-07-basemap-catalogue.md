# Basemap catalogue, and a map preference that is finally read

Source plan: `docs/plans/02-places-and-maps.md`, stage `02-S2` — "A basemap catalogue, and a
preference that is finally read". Reference row `MAP-05 partial → done`.

## 📝 TLDR

`/settings/appearance` lets a traveller pick a map style, stores it on two tables and merges it with
the workspace default — and no map ever reads it. This spec builds the missing consumption seam, and
turns the two-value select into a five-entry catalogue (workspace default, automatic, paper,
charcoal, quiet) whose entries are generated from the `.pmtiles` archive we already serve. It needs
no provider, no migration and no new dependency. It also closes a second defect the seam exposes:
"Follow the workspace" currently pins a snapshot of the workspace value instead of clearing the
override.

## 📝 Problem Statement

The preference is written and never read. Every step of the chain exists except the last one, and
each link was verified against `develop` at `ecb6ef74` rather than taken from the plan:

| Link             | Where                                                              | State                                                     |
| ---------------- | ------------------------------------------------------------------ | --------------------------------------------------------- |
| Workspace column | `organization_settings.map_style` — `src/server/db/schema.ts:2607` | `NOT NULL DEFAULT 'planned-light'`                        |
| Member column    | `user_settings.map_style` — `src/server/db/schema.ts:2647`         | nullable; `NULL` means "follow the workspace"             |
| Precedence       | `getEffectiveSettings` — `src/server/repos/settings.ts:330`        | `user?.mapStyle ?? organization.mapStyle`, already merged |
| Write validation | `mapStyleSchema` — `src/server/repos/settings.ts:114`              | `z.string().trim().min(1).max(64)` — any 64 chars pass    |
| Server function  | `saveAppearance` — `src/routes/_app/-server/settings.ts:296`       | accepts `mapStyle`, writes `user_settings`                |
| Screen           | `src/routes/_app/settings/appearance.tsx:54-59`                    | a `SimpleSelect` with three options                       |
| **Consumer**     | —                                                                  | **none**                                                  |

`grep -rn 'mapStyle' src/components src/lib` returns only `basemapStyle`, an unrelated function that
derives a style document from the resolved colour scheme. `MapCanvas` builds its style from
`useTheme()` alone (`src/components/map/map-canvas.tsx:310`, `buildStyle` at `:352`), so the setting
has never reached a map. Both mount sites — `src/routes/_app/trips/$tripId/-ui/plan-screen.tsx:1100`
and `src/routes/_app/-ui/atlas-screen.tsx:810` — pass no style information at all.

Two consequences a traveller can see today:

1. Choosing **Charcoal — dark** while the app is in the light theme changes nothing on any map.
2. Choosing **Follow the workspace** does not clear the override. The screen sends the workspace's
   _current_ value as a literal (`appearance.tsx:210-215`), and `saveAppearance` maps the `''`
   sentinel to `undefined` rather than `null` (`-server/settings.ts:311-314`), which
   `updateUserSettings` treats as "leave this column alone". There is no path from the UI back to
   `NULL`, so the first entry in the picker is a promise the write path cannot keep. The repository
   already has the right idiom for this — `overrideOrNull()` at `-server/settings.ts:203`, used by
   the language chip and the five regional `Workspace default` options — and the appearance handler
   is the one caller that does not use it.

### Why this is `M` and not `S`

The plan's row scores this `S` on the assumption that a style grid is being added to an existing
select. Measured, the select is the smallest part: the seam that carries an effective id from the
settings row to two `MapCanvas` instances does not exist, and building it is most of the work.

### What this is not

Not a renderer picker and not a tenant-supplied tile account. `docs/SPEC.md` §3 pins the renderer to
MapLibre GL over Protomaps `.pmtiles` from our own `TILES` bucket and freezes the dependency set.
Every catalogue entry here is a different cartography generated from that one archive, which is why
it costs nothing per tenant.

## 📝 Resolved assumptions (autonomous defaults)

This spec was written by an unattended `om-auto-write-spec` run. Each question below was resolved
with the most reversible, smallest-scope answer. Override any of them on this PR before it merges.

| #   | Question                                                                                                                                                              | Resolution                                                                                                                              | Why                                                                                                                                                                                                                                                                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | The source plan contradicts itself on the entry list: its **Data and migration** names a high-contrast entry, its **UI** names five entries without one. Which ships? | Five: `workspace`, `auto`, `planned-light` (Paper), `planned-dark` (Charcoal), `planned-quiet` (Quiet). High-contrast is deferred.      | Smallest scope that still ships a catalogue. High-contrast needs its own palette work and an accessibility target to be measured against; it is additive later and costs nothing to defer.                                                                                                                                                                  |
| Q2  | How does the effective id reach `MapCanvas`?                                                                                                                          | A `useSyncExternalStore` module in `src/lib/map/basemap.ts`, published from `src/routes/_app/route.tsx`, read inside `MapCanvas`.       | The two mount sites live in `plan-screen.tsx` and `atlas-screen.tsx`, which this spec must not own — the source plan reserves `plan-screen.tsx` for stage `02-S4` and it is contended by three stages of `docs/plans/01-trips-core.md`. Reading inside the canvas is what keeps both hosts byte-identical. The idiom is the repo's own: `src/lib/theme.ts`. |
| Q3  | Does `basemapStyle()` gain a `basemap` field (the plan's shape), or does a resolver return style-option overrides the canvas merges?                                  | The resolver. `src/lib/map/style.ts` is **not** edited.                                                                                 | Every catalogue entry is expressible as values of options `BasemapStyleOptions` already has (`theme`, `roadLabels`, `poiLabels`). A resolver returning those is a smaller diff, leaves `MAP_LAYER_IDS` and the 14.9 kB `style.test.ts` untouched, and removes the layer-parity risk the plan's shape creates.                                               |
| Q4  | Does this spec fix the "Follow the workspace" pinning defect, or file it?                                                                                             | Fix it here.                                                                                                                            | `docs/SPEC.md` §8: the preference and its precedence rule are one concept with one owner. Shipping a picker whose first entry silently pins a value would land half the concept. The fix is three lines against an existing helper.                                                                                                                         |
| Q5  | Does `/settings/appearance` get a live `MapCanvas` preview beside the grid, as the plan describes?                                                                    | No. Static swatches built from the palette module's own values; the real proof is the planner and the atlas, which restyle immediately. | Smallest new surface: a WebGL context on a settings route adds a `[data-map-ready]` marker to a page that has none, a skeleton state, an engine-failure state and a second class of console noise, for a preview each entry's swatch already conveys. Deferred, not refused — see **Phasing**, Phase 3.                                                     |
| Q6  | Does `mapStyleSchema` narrow from a free string to the catalogue union?                                                                                               | Yes, on the write path; reads keep a `.catch()` fallback to `auto`.                                                                     | Rejecting an unknown id at the boundary is the point of having a catalogue. A settings screen that 500s on a stale string is a worse product than one that shows a default, so the read side degrades instead of throwing.                                                                                                                                  |
| Q7  | Is the workspace default made settable by an owner on `/settings/organization`?                                                                                       | No.                                                                                                                                     | `workspaceDefaultsInput` (`-server/settings.ts:499`) carries six fields and `mapStyle` is not among them, so `organization_settings.map_style` has no UI writer today. Adding one is a separate capability with its own role gate and its own screen.                                                                                                       |

None of these carries `⚠ NEEDS HUMAN CONFIRMATION`: none weakens tenant scoping, authorisation, a
`BACKWARD_COMPATIBILITY.md` surface, or a stated product decision.

## 📝 Proposed Solution

Three pieces, in dependency order.

1. **A catalogue module.** `src/lib/map/basemap.ts` holds five entries, a resolver that turns
   `(id, resolvedTheme)` into the `BasemapStyleOptions` overrides that entry means, and a tiny
   client store so a preference change reaches a mounted map without a navigation.
2. **The consumption seam.** `MapCanvas` reads the store, folds the resolved overrides into the
   `basemapStyle()` / `fallbackStyle()` call it already makes, and includes the id in the style key
   that guards `setStyle` — so a preference change takes exactly the path a theme change already
   takes today, including the `styleEpoch` bump that lets consumers re-add their layers.
3. **The picker.** `/settings/appearance` swaps its `SimpleSelect` for a `RadioGroup` of five
   `RadioCard`s, and its write path starts using `overrideOrNull()` so the first entry clears the
   override instead of pinning it.

### The catalogue

| Id              | Label     | Palette                | `roadLabels` | `poiLabels` | Stored today |
| --------------- | --------- | ---------------------- | ------------ | ----------- | ------------ |
| `auto`          | Automatic | follows resolved theme | `true`       | `false`     | no           |
| `planned-light` | Paper     | always `light`         | `true`       | `false`     | **yes**      |
| `planned-dark`  | Charcoal  | always `dark`          | `true`       | `false`     | **yes**      |
| `planned-quiet` | Quiet     | follows resolved theme | `false`      | `false`     | no           |

Plus one entry that is not a catalogue id: **Follow the workspace**, which is the absence of a member
override (`user_settings.map_style IS NULL`) and resolves to whatever `organization_settings` holds.

`auto` is today's behaviour, named. `planned-light` and `planned-dark` keep the two ids already in
the columns and their current appearance, which is what makes this migration-free. `planned-quiet`
is the one genuinely new cartography, and it is new only in the sense that it passes
`roadLabels: false` to a function that already accepts it (`src/lib/map/style.ts:193-222`).

### Alternatives considered

- **The plan's shape — `BasemapStyleOptions` gains a `basemap` field, read inside `basemapStyle()`
  and `mapStyleFor()`.** Rejected per Q3: it puts catalogue vocabulary inside the style builder,
  edits a 1,190-line module and its 14.9 kB test suite, and creates a layer-id parity obligation the
  resolver shape does not have. `mapStyleFor()` additionally has no caller outside its own module
  and its own tests, so a field added to it would reach nothing.
- **Prop-drilling the effective id from each route loader to `MapCanvas`.** Rejected per Q2: it
  requires editing `plan-screen.tsx` and `atlas-screen.tsx`, both of which belong to other work
  items, and duplicates the precedence rule at two call sites.
- **Reading the shell's router context inside `MapCanvas`.** The shell is on the router context
  (`src/routes/_app/route.tsx:31`), so a component could read it — but that binds a component in
  `src/components/map` to one route subtree, and the map also renders in contexts outside `_app`
  in future. The store keeps the component's only dependency a module in `src/lib`.

## 📝 Architecture

```
organization_settings.map_style ─┐
                                 ├─► getEffectiveSettings()  (exists, unchanged)
user_settings.map_style ─────────┘            │
                                              ▼
                             loadShell()  →  ShellPayload.mapStyle      [new field]
                                              │
                                              ▼
                          _app/route.tsx  →  publishBasemap(id)         [client only]
                                              │
                                src/lib/map/basemap.ts  (module store)  [new]
                                              │  useBasemap()
                                              ▼
                        MapCanvas ─► resolveBasemap(id, theme) ─► basemapStyle({...})
```

### `src/lib/map/basemap.ts` — new

The owner module of the "basemap catalogue" concept (`docs/SPEC.md` §8). Pure logic, no React
except the `useSyncExternalStore` hook, mirroring `src/lib/theme.ts` line for line in shape.

```ts
export const BASEMAP_IDS = [
  'auto',
  'planned-light',
  'planned-dark',
  'planned-quiet',
] as const
export type BasemapId = (typeof BASEMAP_IDS)[number]

export interface BasemapEntry {
  readonly id: BasemapId
  /** `null` means "follow the resolved colour scheme". */
  readonly palette: ResolvedTheme | null
  readonly roadLabels: boolean
  readonly poiLabels: boolean
}

export const BASEMAPS: Readonly<Record<BasemapId, BasemapEntry>>

/** Style-option overrides for an entry. An unrecognised id resolves as `auto`. */
export function resolveBasemap(
  id: string,
  theme: ResolvedTheme,
): Pick<BasemapStyleOptions, 'theme' | 'roadLabels' | 'poiLabels'>

/** Client store. `publishBasemap` is a no-op on the server. */
export function publishBasemap(id: string): void
export function useBasemap(): BasemapId
```

**The store must not hold request state on the server.** A module-scope mutable value in a Worker is
shared across requests, so `publishBasemap` returns early when `typeof window === 'undefined'`, and
`getServerSnapshot` returns the constant `'auto'`. This costs nothing visually: MapLibre is loaded by
two dynamic imports inside a `useEffect` and never runs during SSR, so no server render ever paints a
basemap that the client would have to correct.

### `src/components/map/map-canvas.tsx` — edit

Three touches, all inside the existing style machinery:

- `const basemapId = useBasemap()`, kept on a ref beside `themeRef` so the mount effect does not
  gain a dependency (`:314-322` is the established pattern in that file).
- `buildStyle(nextTheme, header)` (`:352`) folds `resolveBasemap(basemapId, nextTheme)` into both the
  `fallbackStyle` and the `basemapStyle` branch. The resolver's `theme` wins over the passed one,
  which is how `planned-light` stays paper in the dark theme.
- `styleKey()` (defined `:275`, called `:445` and `:641`) gains the id, so the swap effect at `:639-646`
  fires on a preference change exactly as it fires on a theme change — same `setStyle`, same
  `style.load` handler, same `styleEpoch` bump, so every runtime-added source and layer is re-added
  by the consumers that already listen.

No new effect, no new state, no change to the camera, the readiness marker or the error states.

### `src/routes/_app/-server/shell.ts` — edit

`ShellPayload` (`:39`) gains `readonly mapStyle: string`. `loadShell` resolves it through
`getEffectiveSettings(scope)` — the same merge the settings screen reads, so the precedence rule
stays in the repository and nothing re-derives it.

This is the right carrier rather than `loadDisplayPreferences` (`-server/settings.ts:340`): a map can
appear anywhere under `_app`, and the shell is the one payload every screen behind the session
already waits on. `loadDisplayPreferences` is a per-route opt-in whose two callers are the booking
desk and the transports tab.

### `src/routes/_app/route.tsx` — edit

`AppShell` calls `publishBasemap(shell.mapStyle)` in a `useEffect` — client-only by construction, and
after hydration, which is exactly when the map's own bootstrap runs.

### Files this spec does **not** touch

`src/lib/map/style.ts`, `src/lib/map/palette.ts`, `src/lib/map/bounds.ts`,
`src/components/map/fit-bounds.tsx`, `src/lib/atlas/layout.ts`,
`src/routes/_app/trips/$tripId/-ui/plan-screen.tsx`, `src/routes/_app/-ui/atlas-screen.tsx`,
`src/components/ui/radio-group.tsx`, `src/routes/_app/-ui/settings-nav.tsx`, and the theme grid in
`appearance.tsx:115-175`, which stays byte-identical.

The camera is protected on purpose: `MAP-06` is already ahead of the reference product and the source
plan forbids any stage from moving it.

## 📝 Data Model

**No schema change and no migration.** Both columns exist and both already hold valid values.

| Column                            | Type                                    | After this change                                              |
| --------------------------------- | --------------------------------------- | -------------------------------------------------------------- |
| `organization_settings.map_style` | `text NOT NULL DEFAULT 'planned-light'` | unchanged; still the only writer is the default                |
| `user_settings.map_style`         | `text NULL`                             | `NULL` finally reachable from the UI; values narrowed on write |

The catalogue is additive over the two stored ids: `planned-light` and `planned-dark` stay valid with
their current appearance, `auto` and `planned-quiet` are values no existing row holds. Nothing is
backfilled and nothing is renamed, so a rollback to the previous Worker keeps working against
unchanged columns.

**Writers, enumerated rather than assumed.** `saveAppearance` (`-server/settings.ts:296`) and the dev
seeder (`src/routes/api/dev/-seed/dataset/index.ts:88`, `'planned-light'`). `workspaceDefaultsInput`
does not carry `mapStyle`, so no owner-facing form writes the workspace column. That is what makes
the narrowing in `mapStyleSchema` safe: no row can be holding a value the union rejects.

**Sensitive data:** none. A display preference is not PII and is scoped by `organization_id` on both
tables through `tenantFilter()` (`src/server/repos/base.ts`), which this spec does not change.

## 📝 API Contracts

No new server function and no new endpoint. Three validators change.

### `src/server/repos/settings.ts`

```ts
// :114 — was z.string().trim().min(1).max(64)
const mapStyleSchema = z.enum(BASEMAP_IDS, {
  error: 'Pick a map style from the catalogue.',
})
```

Used by `updateOrganizationSettingsInput.mapStyle` (`.optional()`) and
`updateUserSettingsInput.mapStyle` (`.nullish()`, unchanged — `null` is how the override is cleared).

`getEffectiveSettings` (`:294`) keeps returning `string`, but its `mapStyle` line gains the same
`.catch()` treatment `theme`, `locale` and `distanceUnit` already have:

```ts
mapStyle: z.enum(BASEMAP_IDS).catch('auto').parse(user?.mapStyle ?? organization.mapStyle),
```

A row holding an unrecognised id therefore reads as `auto` rather than throwing, which is Q6.

### `src/routes/_app/-server/settings.ts`

```ts
// saveAppearance validator, :302
mapStyle: z.union([z.literal(''), z.enum(BASEMAP_IDS)]).optional(),

// saveAppearance handler, :311-314 — the defect fix
mapStyle: data.mapStyle === undefined ? undefined : overrideOrNull(data.mapStyle),
```

`undefined` keeps meaning "this patch does not touch the column" — `updateUserSettings` passes its
parsed patch through `definedOnly`. `''` now means "clear the override", via the same
`overrideOrNull()` the language chip and the regional form use. This matches the sentinel convention
documented at `-server/settings.ts:195-205`.

`AppearancePayload` (`:268`) gains `readonly mapStyleOverride: string | null` — the raw
`user_settings` value — so the picker can tell "I chose Paper, and the workspace also happens to be
Paper" from "I follow the workspace". Today's screen guesses this by comparing the effective value to
the workspace value (`appearance.tsx:81-85`) and gets it wrong whenever they coincide.

`ShellPayload` (`shell.ts:39`) gains `readonly mapStyle: string`.

**Authorisation is unchanged.** `loadShell` resolves the session and `saveAppearance` writes only
inside the caller's own tenant scope. A well-formed basemap id from the client is not permission to
write anybody else's settings row.

## 📝 UI/UX

### The grid

One `RadioGroup` on `/settings/appearance`, inside the existing **Motion and maps** section, holding
five `RadioCard`s in the order: Follow the workspace, Automatic, Paper, Charcoal, Quiet.

- `RadioGroup` / `RadioCard` from `src/components/ui/radio-group.tsx`, imported through the
  `#/components/ui` barrel. This is not a preference: the module is shipped and tokenised, and it is
  already the product's selectable-card control at
  `src/routes/_app/console/-ui/create-account.tsx:144`,
  `provider-limit-dialog.tsx:194` and `user-actions.tsx:433`. Building a second one here would be a
  defect. (The source plan states this module has no consumers; that reading is stale — the three
  call sites above are on `develop` at `ecb6ef74`.)
- **The theme grid two rows above is the wrong precedent and stays untouched.** It is a hand-rolled
  `aria-pressed` `<button>` grid (`appearance.tsx:119-168`) that predates the primitive. Copying its
  shape is how this work would end up with a hand-rolled radio group. Converting it is also out of
  scope — that is a separate change to a file this one only visits.
- Radix supplies the roving tabindex, so the whole group is one tab stop and arrow keys move and
  select. That is why this is a real radio set rather than five buttons that behave like one.
- Layout: `grid gap-3 sm:grid-cols-2 lg:grid-cols-3`. Single column at 360.
- Each card carries `label` and a one-line `description`, so selection reads without colour; the
  checked card additionally gets `RadioCard`'s brand border, `--color-brand-subtle` fill and the
  `animate-pop-in` check badge.
- Group accessible name: `aria-label={t('settings.appearance.map.label')}`, matching how the motion
  switch names itself on the same screen.

### The swatch

Passed through `RadioCard`'s `icon` slot: a `size-9` rounded tile showing that entry's land, water
and road colours, taken from `mapPalette()` in `src/lib/map/palette.ts` rather than re-derived, with
the Quiet entry's tile drawn without its label stroke. Two details that are easy to get wrong:

- The `icon` wrapper carries `group-data-[state=checked]:bg-brand` (`radio-group.tsx:178`), so the
  swatch must paint its own opaque background over the full `size-9` box or the selected card's
  swatch turns brand-coloured.
- A larger, full-bleed preview tile would be a new prop on `RadioCard`, i.e. a change to
  `src/components/ui/**`. Stated here and deliberately not taken: the 36 px leading glyph ships, and
  the full-bleed form is a separate primitive change if the design asks for it.

### States

- **Empty** — not applicable. The catalogue is a constant of four entries plus the workspace entry
  and cannot be empty. Named so it is not mistaken for an omission.
- **Loading** — the whole group is `disabled` while a save is in flight, which is the `busy` idiom
  this screen already applies to the theme buttons and both switches (`appearance.tsx:86`).
- **Error** — a failed save keeps the screen's existing `toast.error` with
  `settings.appearance.saveFailed` / `saveFailedBody`, and the selection returns to the last saved
  entry rather than lying about what is stored. Reused rather than replaced with an inline `Alert`,
  because it is the pattern the other three rows on this screen use.
- **Skeleton** — `AppearancePending` (`appearance.tsx:258`) gains a five-tile grid in place of its
  single `h-10` select bar, so the page does not reflow when the loader resolves.

### Tokens and motion

No new token. Surfaces `--color-surface` / `--color-surface-2`, selected hairline `--color-brand`,
radii `--radius-lg`, and the check badge's `animate-pop-in`, all inherited from `RadioCard`.
`transitionBase`, `focusRing` and `disabledState` come with the primitive, so hover, `focus-visible`,
active and disabled match every other card in the product. `prefers-reduced-motion: reduce` is
already honoured by the shared utilities.

### The test hook

Each card carries `data-part="basemap-option"` and `value="<id>"`. `RadioCard` spreads `...props`
onto `RadioGroupPrimitive.Item` (`radio-group.tsx:171`), and `@radix-ui/react-radio-group` renders
that as `<button type="button" role="radio" data-state="…" value="…">`, so both are real attributes
on the matched element and there is no `<input>` to target.

The `data-part` convention is already established on this exact route —
`data-part="mask-confirmation-codes"` at `appearance.tsx:240`. (The source plan states that nothing
under `src/routes/_app/settings/**` publishes a `data-part`; that reading is stale.)

The workspace entry uses `value=""`, matching the `''` sentinel the write path now understands.

## 📝 Visual change expected

Light and dark, 360 px and 1440 px, for every row.

| Route                  | State                       | What changes                                                                                                                                               |
| ---------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/settings/appearance` | resting                     | The **Map style** row's single-line `SimpleSelect` becomes a five-card radio grid: 1 column at 360, 2 from `sm`, 3 from `lg`. The section grows in height. |
| `/settings/appearance` | Charcoal selected           | Brand border, `--color-brand-subtle` fill and the check badge on the Charcoal card.                                                                        |
| `/settings/appearance` | pending (loader)            | `AppearancePending`'s second card shows five tiles instead of one bar.                                                                                     |
| `/trips/$tripId/plan`  | Charcoal saved, light theme | The map canvas paints the dark cartography while the page chrome stays light. This is the frame that proves the preference is read rather than inferred.   |
| `/trips/$tripId/plan`  | Quiet saved                 | Road and place labels disappear from the basemap; pins, clusters, day lines, chrome and camera framing are unchanged.                                      |
| `/atlas`               | Charcoal saved, light theme | Same as the planner: canvas dark, chrome light.                                                                                                            |

No change to the camera, the pins, the clusters, the day route lines, the category filter bar, the
legend, the attribution line, or the layout of either map screen. Nothing outside the **Motion and
maps** section of `/settings/appearance` moves.

Per ADR 0016 the visual judgement is the blind A/B pair, not a pixel baseline: run
`node scripts/visual/capture.mjs --url <route> --out <dir> --label <A|B> --viewports 360x800,1440x900,2560x1440 --themes light,dark --auth --map`
for the three routes and read the pairs at review. A frame whose chrome and map disagree about the
theme is a capture that changed the theme without waiting for the map to repaint, not a defect.

## 📝 Copy

Namespace `settings` (`src/lib/i18n/messages/<locale>/settings.ts`). Every key below lands in all 23
locales in the same change, per the `i18n-messages` skill and `docs/SPEC.md` §9. English text is the
source; translations are authored from it, never from the reference product's catalogues.

**New keys — `en` text:**

| Key                                     | Text                                               |
| --------------------------------------- | -------------------------------------------------- |
| `settings.appearance.map.workspaceHint` | `Whatever the workspace owner chose.`              |
| `settings.appearance.map.auto`          | `Automatic`                                        |
| `settings.appearance.map.autoHint`      | `Follows your light or dark theme.`                |
| `settings.appearance.map.paper`         | `Paper`                                            |
| `settings.appearance.map.paperHint`     | `Warm and light, whichever theme you are in.`      |
| `settings.appearance.map.charcoal`      | `Charcoal`                                         |
| `settings.appearance.map.charcoalHint`  | `Warm and dark, whichever theme you are in.`       |
| `settings.appearance.map.quiet`         | `Quiet`                                            |
| `settings.appearance.map.quietHint`     | `No road or place names, so your pins read first.` |

**Removed keys** — removed from all 23 files in the same change, or the parity test fails on orphans:

| Key                             | Current `en` text | Replaced by                        |
| ------------------------------- | ----------------- | ---------------------------------- |
| `settings.appearance.map.light` | `Paper — light`   | `settings.appearance.map.paper`    |
| `settings.appearance.map.dark`  | `Charcoal — dark` | `settings.appearance.map.charcoal` |

They are renamed rather than retexted because the entries are no longer theme-bound: Paper stays
paper in the dark theme, which is the whole point of having them beside `Automatic`.

**Unchanged, reused:** `settings.appearance.map.label` (`Map style`),
`settings.appearance.map.hint` (`The basemap used on the planner and the atlas.`),
`settings.appearance.map.workspace` (`Follow the workspace`),
`settings.appearance.saveFailed`, `settings.appearance.saveFailedBody`, `ui.status.loading`.

No copy is hardcoded in a component, and no string is composed from fragments — `ar` is RTL and
`pl`/`ru`/`uk`/`cs` need plural branches `en` does not have, though none of these keys is plural.

## 📝 Edge Cases & Failure Scenarios

| Case                                                              | Behaviour                                                                                                                                                                                                                          |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A row holds an id outside the catalogue                           | `getEffectiveSettings` `.catch('auto')` resolves it to Automatic. Nothing throws, the settings screen renders, and the next save writes a valid id. Cannot arise from any current writer; the guard is for a future one.           |
| A client POSTs an unknown id                                      | Zod rejects at the boundary; the toast shows and the column is untouched.                                                                                                                                                          |
| The traveller changes the preference while a map is mounted       | The store notifies, `styleKey` changes, the existing swap effect calls `setStyle`, `style.load` bumps `styleEpoch`, consumers re-add their runtime layers. Identical to a theme change, which already works.                       |
| Browser has no WebGL2                                             | `MapCanvas` already resolves `engine: 'unsupported'` and `basemap: 'unavailable'` (`map-canvas.tsx:418-437`). The picker still works — its swatches are CSS.                                                                       |
| The `.pmtiles` archive is missing (a fresh worktree, no local R2) | `mapStyleFor`'s fallback branch runs, and `resolveBasemap`'s `theme` override applies to `fallbackStyle` too, so Paper stays paper on the fallback style. Road and POI label options do not exist on the fallback and are ignored. |
| SSR renders before the store is published                         | `getServerSnapshot` returns `auto`. No basemap is painted during SSR — MapLibre loads behind two dynamic imports inside an effect — so there is no flash to correct.                                                               |
| Two tabs, one changes the preference                              | The other tab keeps its own value until its next `loadShell`. Acceptable: a display preference is not realtime state, and nothing here goes near `TripRoom`.                                                                       |
| The workspace default changes while a member follows it           | The member picks it up on their next shell load. Same mechanism as the workspace language.                                                                                                                                         |
| "Follow the workspace" chosen when it equals the current value    | The override is cleared (`NULL`), not pinned. Distinguishable on reload because `AppearancePayload.mapStyleOverride` carries the raw column.                                                                                       |
| A save fails mid-flight                                           | Toast, group re-enabled, selection reverts to the last saved entry.                                                                                                                                                                |

## 📝 Risks & Impact Review

**Blast radius.** Two map screens and one settings screen. The shell payload gains one field, which
every screen behind `_app` deserialises — a shape change with no behavioural effect on any existing
consumer, and cheap: `loadShell` already awaits the session, and `getEffectiveSettings` is two
single-row reads under one `Promise.all` on indexes that exist.

**The one real risk is `styleKey`.** Getting the id into the swap effect's key wrong in either
direction is a defect that unit tests will not catch: omitted, a preference change never repaints;
over-eager, every render calls `setStyle` and the map flickers and drops runtime layers. The guard is
the e2e assertion that a saved preference changes the planner canvas and that `styleEpoch` advances
exactly once per distinct change.

**Migration and compatibility.** None and none. No column, no index, no `drizzle/` file. The
narrowing is a write-side tightening over a value set no stored row leaves. `pnpm generate-routes`
is not needed — no route file is added.

**Rollback.** Deploy the previous Worker. Both columns are unchanged, so `planned-light` and
`planned-dark` read as they did; a row holding `auto` or `planned-quiet` passes the old free-string
schema and the old code path ignores it entirely, which is the pre-change behaviour. Nothing to undo
in the database.

**Where this sits relative to the plan.** `docs/plans/02-places-and-maps.md` schedules `02-S2` in
wave 1 as the earliest claimant of `-server/settings.ts`, `repos/settings.ts`, `appearance.tsx` and
`-server/shell.ts`, ahead of `09-S8`, `03-S6`, `00-S3` and `08-S10`. Landing it first is the useful
direction: each of those inherits a validated union and one extra shell field rather than a free
string.

**One correction to the plan's verification block, and it matters for anyone executing it.** That
block cites `scripts/ultrabuild/capture.mjs`, `scripts/ultrabuild/resolve-port.sh`,
`e2e/places-and-maps.visual.spec.ts` and `e2e/__screenshots__/`. None of them exists on `develop`:
`scripts/ultrabuild/` was retired by ADR 0004 and then ADR 0014, and ADR 0016 replaced the screenshot
baselines with the critical journeys plus the blind A/B pair. The verification below is written
against the ladder this repository actually runs (`.claude/skills/verifying-changes`).

## 📋 Phasing

Three phases. Phase 1 and 2 together close `MAP-05`; Phase 3 is optional polish that can be dropped
without leaving anything half-landed.

- **Phase 1 — the catalogue and the seam.** Ship the module, the resolver, the store and the canvas
  read. No user-visible change yet: the existing select still writes only `planned-light` and
  `planned-dark`, but those two ids now actually reach the map. Independently shippable, and on its
  own it already fixes the "Charcoal in the light theme does nothing" defect.
- **Phase 2 — the picker and the override fix.** Narrow the validators, add the `mapStyleOverride`
  field, replace the select with the grid, land the copy in 23 locales. Independently shippable on
  top of Phase 1.
- **Phase 3 — the live preview.** A single `MapCanvas` at `interactive={false}` beside the grid,
  reserving its box behind a `Skeleton` until `[data-map-ready]` flips. Deferred per Q5 and listed
  so it is not re-derived from scratch later.

## 📋 Implementation Plan

Each step leaves the application working and is verifiable on its own. The gate is
`.ai/agentic.config.json` `validation.commands`: `pnpm typecheck`, `pnpm lint`, `pnpm test`,
`bash .ai/scripts/check-generated.sh`, `pnpm build`, `bash .ai/scripts/e2e.sh`.

### Phase 1 — the catalogue and the seam

1. **Write `src/lib/map/basemap.ts`.** `BASEMAP_IDS`, `BasemapId`, `BASEMAPS`, `resolveBasemap`,
   `publishBasemap`, `useBasemap`. The store mirrors `src/lib/theme.ts`: stable snapshot identity,
   `getServerSnapshot` returning the constant `'auto'`, `publishBasemap` a no-op off the browser.
   _Verify:_ `src/lib/map/__tests__/basemap.test.ts` — every id unique and resolvable; `planned-light`
   and `planned-dark` still resolve, which is the back-compat guarantee the no-migration claim rests
   on; `auto` resolves to the light palette under `light` and the dark palette under `dark`;
   `planned-light` resolves to the light palette under **both** themes; `planned-quiet` sets
   `roadLabels: false`; an unknown id resolves as `auto` rather than throwing; the store notifies a
   subscriber exactly once per distinct change and not at all for a repeat.
2. **Re-export from `src/components/map/index.ts`.** Catalogue and hook, behind the existing barrel.
   _Verify:_ `pnpm typecheck`.
3. **Read the store in `src/components/map/map-canvas.tsx`.** `useBasemap()` on a ref beside
   `themeRef`; `resolveBasemap` folded into `buildStyle`; the id added to `styleKey`.
   _Verify:_ `pnpm typecheck`, `pnpm test`, then load `/trips/$tripId/plan`, call
   `publishBasemap('planned-dark')` from the console in the light theme, and watch the canvas restyle
   while the chrome stays light.
4. **Carry the effective id on the shell.** `ShellPayload.mapStyle` in
   `src/routes/_app/-server/shell.ts`, resolved through `getEffectiveSettings`;
   `publishBasemap(shell.mapStyle)` in an effect in `src/routes/_app/route.tsx`.
   _Verify:_ `pnpm typecheck`, `pnpm test`; set `user_settings.map_style` to `'planned-dark'` in local
   D1 and confirm both `/atlas` and the planner open dark in the light theme.

### Phase 2 — the picker and the override fix

5. **Narrow the write path.** `mapStyleSchema` to `z.enum(BASEMAP_IDS)` in
   `src/server/repos/settings.ts`; the `.catch('auto')` on the `getEffectiveSettings` read;
   `saveAppearance`'s validator to `z.union([z.literal(''), z.enum(BASEMAP_IDS)]).optional()` and its
   handler to `overrideOrNull`.
   _Verify:_ unit tests for the repository input schemas — an unknown id is rejected, `''` clears the
   override to `NULL`, `undefined` leaves the column untouched, and a stored unknown id reads as
   `auto`.
6. **Append the tenant isolation case.** In the existing
   `a foreign parent id is rejected, never re-scoped` describe block of
   `src/server/repos/__tests__/tenant-isolation.test.ts`: under organization A's scope, reading and
   updating B's `organization_settings` and `user_settings` rows by id raises `NotFoundError`, and
   B's `map_style` is byte-identical afterwards. Append only — every plan treats this file
   cooperatively.
   _Verify:_ `pnpm test`.
7. **Expose the raw override.** `AppearancePayload.mapStyleOverride` in
   `src/routes/_app/-server/settings.ts`, read from `userRow.mapStyle`.
   _Verify:_ `pnpm typecheck`.
8. **Land the copy.** Nine new keys and two removals across all 23 files under
   `src/lib/i18n/messages/`, per the `i18n-messages` skill.
   _Verify:_ `pnpm test` — `src/lib/i18n/__tests__/parity.test.ts` names the exact locale and key on
   failure.
9. **Build the picker.** `src/routes/_app/-ui/basemap-picker.tsx`: the `RadioGroup`, the five
   `RadioCard`s with their swatches, `data-part="basemap-option"` and `value`, the `busy` disabled
   state. It composes primitives and defines no selection control of its own.
   _Verify:_ `pnpm typecheck`, `pnpm lint`.
10. **Mount it.** Replace the `SimpleSelect` in `src/routes/_app/settings/appearance.tsx`'s Map style
    row and widen `AppearancePending`'s second card to a five-tile grid. The theme grid above is left
    byte-identical.
    _Verify:_ `pnpm build`; keyboard walk — one tab stop for the group, arrow keys move and select,
    WCAG 2.2 AA contrast in both themes.
11. **Add the browser evidence.** `e2e/basemap-preference.spec.ts`, opening with
    `await expect(page.locator('[data-part="basemap-option"][value="planned-dark"]')).toHaveCount(1)`
    on `/settings/appearance` — the selector assertion runs before anything depends on it. Then:
    selecting Charcoal in the light theme makes the planner canvas paint dark while the chrome stays
    light; selecting Follow the workspace clears the override and the map returns to the workspace
    cartography; the console is silent throughout, per `e2e/helpers/console-policy.ts`.
    _Verify:_ `bash .ai/scripts/e2e.sh`, then the blind A/B pair over the three routes listed under
    **Visual change expected**.

### Out of scope, recorded so it is not re-derived

- The high-contrast catalogue entry (Q1).
- The live `MapCanvas` preview on the settings screen (Q5, Phase 3).
- An owner-facing workspace-default map style on `/settings/organization` (Q7).
- Converting the theme grid to `RadioCard`. It is a real inconsistency on the same screen, and it
  belongs to whoever next owns that file rather than to this change.
- A full-bleed preview tile variant of `RadioCard` in `src/components/ui/**`.
