# Execution plan — basemap-catalogue

**Run started:** 2026-09-07T18:17:12Z
**Branch:** `feat/basemap-catalogue`
**Base:** `develop`
**Engine:** `om-auto-create-pr-loop` (`--loop` forwarded by `om-auto-implement-spec`)
**Source spec:** `.ai/specs/2026-09-07-basemap-catalogue.md`
**Spec PR:** #307 (design-only, merged into `develop` at `67808732`)

## Tasks

> Authoritative status table. `Status` is one of `todo` or `done`. On landing a Step, flip `Status` to `done` and fill the `Commit` column with the short SHA. The first row whose `Status` is not `done` is the resume point for `om-auto-continue-pr-loop`. Step ids and `Exec` cells are immutable once the plan is committed — per-Step commits touch only `Status` and `Commit`.
>
> **`Commit` is filled one Step late, on purpose.** A row cannot name the SHA of the commit that contains it — writing the hash changes the hash. So a Step's own commit flips `Status` to `done` and writes `pending`, and the next commit that touches this file replaces it with the real short SHA. `Status` is the resume field and is always correct in its own commit.

| Phase | Step | Title                                                      | Exec           | Status | Commit   |
| ----- | ---- | ---------------------------------------------------------- | -------------- | ------ | -------- |
| 1     | 1.1  | Write the basemap catalogue module and its tests           | dispatch       | done   | 076095bf |
| 1     | 1.2  | Re-export the catalogue from the map barrel                | inline         | done   | 668b41f1 |
| 1     | 1.3  | Read the basemap store in MapCanvas                        | inline         | done   | 55810e74 |
| 1     | 1.4  | Carry the effective basemap id on the shell payload        | inline         | done   | ce04f734 |
| 2     | 2.1  | Narrow the map-style write path and clear the override     | dispatch       | done   | 56e41254 |
| 2     | 2.2  | Append the settings tenant-isolation case                  | dispatch:cheap | done   | 3543cae7 |
| 2     | 2.3  | Expose the raw member override on AppearancePayload        | inline         | done   | 580e6587 |
| 2     | 2.4  | Land the catalogue copy in 23 locales and build the picker | dispatch       | done   | 872cc0f9 |
| 2     | 2.5  | Mount the picker and retire the two theme-bound keys       | inline         | done   | dedd0c54 |
| 2     | 2.6  | Add the browser evidence for the basemap preference        | dispatch       | done   | dd46434a |

## Goal

`/settings/appearance` writes a map-style preference that no map has ever read. Build the missing
consumption seam, turn the two-value select into a five-entry catalogue, and fix the defect the seam
exposes: "Follow the workspace" pins a snapshot of the workspace value instead of clearing the
member override. Closes `MAP-05`.

## Scope

Exactly the files the spec's **Architecture** section names:

- **new** `src/lib/map/basemap.ts`, `src/lib/map/__tests__/basemap.test.ts`,
  `src/routes/_app/-ui/basemap-picker.tsx`, `e2e/basemap-preference.spec.ts`
- **edit** `src/components/map/index.ts`, `src/components/map/map-canvas.tsx`,
  `src/routes/_app/-server/shell.ts`, `src/routes/_app/route.tsx`,
  `src/server/repos/settings.ts`, `src/routes/_app/-server/settings.ts`,
  `src/routes/_app/settings/appearance.tsx`,
  `src/server/repos/__tests__/tenant-isolation.test.ts`, and the 23
  `src/lib/i18n/messages/<locale>/settings.ts` files.

## Non-goals

Carried verbatim from the spec's **Out of scope** and **Files this spec does not touch**:

- `src/lib/map/style.ts`, `src/lib/map/palette.ts`, `src/lib/map/bounds.ts`, and the 14.9 kB
  `style.test.ts` — the resolver returns style-option overrides rather than adding a `basemap`
  field (spec Q3).
- `src/routes/_app/trips/$tripId/-ui/plan-screen.tsx` and `src/routes/_app/-ui/atlas-screen.tsx` —
  the store is what keeps both mount sites byte-identical (spec Q2). Both belong to other stages.
- `src/components/ui/radio-group.tsx` — the picker composes the shipped primitive; no full-bleed
  preview variant (spec UI/UX).
- The theme grid at `appearance.tsx:115-175`, which stays byte-identical.
- The high-contrast catalogue entry (Q1), the live `MapCanvas` preview on the settings screen
  (Q5, spec Phase 3), and an owner-facing workspace-default map style (Q7).
- No schema change, no migration, no new dependency, no camera change.

## Implementation Plan

### Phase 1 — the catalogue and the seam

Ships the module, the resolver, the store and the canvas read. No user-visible change: the existing
select still writes only `planned-light` and `planned-dark`, but those two ids finally reach the map,
which on its own fixes "Charcoal in the light theme does nothing".

#### 1.1 Write the basemap catalogue module and its tests

- New `src/lib/map/basemap.ts` exporting `BASEMAP_IDS`, `BasemapId`, `BasemapEntry`, `BASEMAPS`,
  `resolveBasemap`, `publishBasemap`, `useBasemap` — the API block in the spec's **Architecture**
  section is the contract.
- The store mirrors `src/lib/theme.ts` in shape: module-scope state, a `Set` of listeners, a stable
  `SERVER_STATE` snapshot identity, `getServerSnapshot` returning the constant `'auto'`, and
  `publishBasemap` returning early when `typeof window === 'undefined'` so a Worker isolate never
  holds request state.
- `resolveBasemap(id, theme)` returns `Pick<BasemapStyleOptions, 'theme' | 'roadLabels' | 'poiLabels'>`;
  an unrecognised id resolves as `auto` rather than throwing.
- New `src/lib/map/__tests__/basemap.test.ts` covering: every id unique and resolvable;
  `planned-light` / `planned-dark` still resolve (the back-compat guarantee the no-migration claim
  rests on); `auto` follows the resolved theme; `planned-light` stays the light palette under **both**
  themes; `planned-quiet` sets `roadLabels: false`; an unknown id resolves as `auto`; the store
  notifies a subscriber exactly once per distinct change and not at all for a repeat.
- _Verify:_ `pnpm vitest run src/lib/map/__tests__/basemap.test.ts`, `pnpm typecheck`.

#### 1.2 Re-export the catalogue from the map barrel

- `src/components/map/index.ts` re-exports the catalogue and the hook behind the existing barrel,
  in the `#/lib/map` re-export block it already keeps.
- _Verify:_ `pnpm typecheck`.

#### 1.3 Read the basemap store in MapCanvas

The one real risk in this plan, per the spec's **Risks** section: get the id into the swap effect's
key wrong in either direction and no unit test catches it.

- `const basemapId = useBasemap()` kept on a ref beside `themeRef` (`map-canvas.tsx:314-322` is the
  established pattern), so the mount effect gains no dependency.
- `buildStyle` folds `resolveBasemap(basemapId, nextTheme)` into **both** the `fallbackStyle` and the
  `basemapStyle` branch. The resolver's `theme` wins over the passed one — that is how
  `planned-light` stays paper in the dark theme.
- `styleKey()` gains the id, so the swap effect fires on a preference change exactly as it fires on a
  theme change: same `setStyle`, same `style.load`, same `styleEpoch` bump, so runtime layers are
  re-added by the consumers already listening.
- No new effect, no new state, no change to the camera, the readiness marker or the error states.
- _Verify:_ `pnpm typecheck`, `pnpm vitest run src/components/map src/lib/map`.

#### 1.4 Carry the effective basemap id on the shell payload

- `ShellPayload` gains `readonly mapStyle: string`, resolved in `loadShell` through
  `getEffectiveSettings(scope)` — the same merge the settings screen reads, so the precedence rule
  stays in the repository.
- `AppShell` calls `publishBasemap(shell.mapStyle)` in a `useEffect`: client-only by construction and
  after hydration, which is when the map's own bootstrap runs.
- _Verify:_ `pnpm typecheck`, `pnpm test`.

### Phase 2 — the picker and the override fix

#### 2.1 Narrow the map-style write path and clear the override

- `src/server/repos/settings.ts`: `mapStyleSchema` becomes `z.enum(BASEMAP_IDS)` with the catalogue
  error message; `getEffectiveSettings`'s `mapStyle` line gains the `.catch('auto')` treatment
  `theme`, `locale` and `distanceUnit` already have.
- `src/routes/_app/-server/settings.ts`: `saveAppearance`'s validator becomes
  `z.union([z.literal(''), z.enum(BASEMAP_IDS)]).optional()`, and its handler routes through
  `overrideOrNull` so `''` clears the column to `NULL` instead of being dropped as `undefined`.
- Unit tests for the input schemas: an unknown id is rejected, `''` clears the override to `NULL`,
  `undefined` leaves the column untouched, and a stored unknown id reads as `auto`.
- _Verify:_ `pnpm typecheck`, the settings repo tests.

#### 2.2 Append the settings tenant-isolation case

- Append to the existing `a foreign parent id is rejected, never re-scoped` describe block of
  `src/server/repos/__tests__/tenant-isolation.test.ts`: under organization A's scope, reading and
  updating B's `organization_settings` and `user_settings` rows by id raises `NotFoundError`, and B's
  `map_style` is byte-identical afterwards. **Append only** — every plan treats this file
  cooperatively.
- _Verify:_ `pnpm vitest run src/server/repos/__tests__/tenant-isolation.test.ts`.

#### 2.3 Expose the raw member override on AppearancePayload

- `AppearancePayload` gains `readonly mapStyleOverride: string | null`, read from `userRow.mapStyle`,
  so the picker can tell "I chose Paper, and the workspace also happens to be Paper" from "I follow
  the workspace" — which today's screen guesses by comparing effective to workspace and gets wrong
  whenever they coincide.
- _Verify:_ `pnpm typecheck`.

#### 2.4 Land the catalogue copy in 23 locales and build the picker

**Merged from the spec's Steps 8 and 9, deliberately — see Risks.** One commit, because
`src/lib/i18n/__tests__/coverage.test.ts` fails a catalogued key that no source literal reads
(`DEAD_KEYS = 9`, an exact budget), and `MessageKey` fails to compile for a literal with no
catalogue entry. Copy and its first reader therefore cannot be separated without a red Step.

- Nine new keys across all 23 `src/lib/i18n/messages/<locale>/settings.ts` files, per the
  `i18n-messages` skill: `appearance.map.workspaceHint`, `.auto`, `.autoHint`, `.paper`,
  `.paperHint`, `.charcoal`, `.charcoalHint`, `.quiet`, `.quietHint`. English text is the source;
  translations are authored from it, never from a reference product's catalogue.
- New `src/routes/_app/-ui/basemap-picker.tsx`: the `RadioGroup`, five `RadioCard`s in the order
  Follow the workspace / Automatic / Paper / Charcoal / Quiet, each with `data-part="basemap-option"`
  and its `value` (the workspace entry uses `value=""`, matching the write path's sentinel), a
  `busy` disabled state, and `grid gap-3 sm:grid-cols-2 lg:grid-cols-3`.
- The swatch goes through `RadioCard`'s `icon` slot, built from `mapPalette()` rather than
  re-derived, and must paint its own opaque background over the full `size-9` box — the icon wrapper
  carries `group-data-[state=checked]:bg-brand` (`radio-group.tsx:178`) and would otherwise turn the
  selected card's swatch brand-coloured.
- The component composes primitives and defines no selection control of its own.
- _Verify:_ `pnpm typecheck`, `pnpm lint`, `pnpm vitest run src/lib/i18n`.

#### 2.5 Mount the picker and retire the two theme-bound keys

- Replace the `SimpleSelect` in `appearance.tsx`'s Map style row with the picker, driven by
  `data.mapStyleOverride` rather than the effective/workspace comparison; widen `AppearancePending`'s
  second card to a five-tile grid so the page does not reflow when the loader resolves.
- Remove `settings.appearance.map.light` and `.dark` from all 23 files in the same commit — this is
  the Step where their last reader disappears, so it is the only Step in which the catalogue,
  `MessageKey` and the dead-key budget are all simultaneously satisfied.
- The theme grid above stays byte-identical.
- _Verify:_ `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; keyboard walk — one tab stop
  for the group, arrow keys move and select, WCAG 2.2 AA contrast in both themes.

#### 2.6 Add the browser evidence for the basemap preference

- New `e2e/basemap-preference.spec.ts`, opening with
  `await expect(page.locator('[data-part="basemap-option"][value="planned-dark"]')).toHaveCount(1)`
  on `/settings/appearance` — the selector assertion runs before anything depends on it. Then:
  selecting Charcoal in the light theme makes the planner canvas paint dark while the chrome stays
  light; selecting Follow the workspace clears the override and the map returns to the workspace
  cartography; the console is silent throughout, per `e2e/helpers/console-policy.ts`.
- _Verify:_ `bash .ai/scripts/e2e.sh`.

## Risks

- **`styleKey` is the one defect unit tests cannot catch** (spec **Risks & Impact Review**). Omitted,
  a preference change never repaints; over-eager, every render calls `setStyle` and the map flickers
  and drops runtime layers. Step 2.6's e2e assertion is the guard.
- **The spec's 11-step breakdown is followed as 10 Steps.** Its Steps 8 (copy) and 9 (picker) are
  merged into 2.4, and its Step 10 (mount) absorbs the two key removals as 2.5. Landing either half
  alone is a red Step: `src/lib/i18n/__tests__/coverage.test.ts` holds an exact `DEAD_KEYS = 9`
  budget that nine reader-less keys would break, and `MessageKey` is derived from the `en` catalogue
  so a component cannot name a key before it exists. Every Step in this plan leaves the gate green,
  which is the property the spec's step list was written to have.
- **The shell payload grows by one field**, deserialised by every screen behind `_app`. A shape
  change with no behavioural effect on any existing consumer, and cheap: `loadShell` already awaits
  the session and `getEffectiveSettings` is two single-row reads under one `Promise.all` on existing
  indexes.
- **No migration, no rollback work.** Both columns are unchanged; a row holding `auto` or
  `planned-quiet` passes the old free-string schema and the old code path ignores it, which is the
  pre-change behaviour.

## External References

None — no `--skill-url` was passed. The repo-local `i18n-messages` and `verifying-changes` skills
are consulted for Steps 2.4/2.5 and the final gate respectively.

## Validation gate

`.ai/agentic.config.json` `validation.commands`, in order: `pnpm typecheck`, `pnpm lint`,
`pnpm test`, `bash .ai/scripts/check-generated.sh`, `pnpm build`, `bash .ai/scripts/e2e.sh`.
