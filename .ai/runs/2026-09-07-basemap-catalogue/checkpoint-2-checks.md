# Checkpoint 2 — Phase 2 through the mount

**When:** 2026-09-07T21:05:00Z
**Steps covered:** 2.1 → 2.5 (`56e41254`..`b5f86ff6`, seven commits: five Steps and two corrections)
**Why it fired:** five Steps since checkpoint 1.

## Touched areas

| Area          | Files                                                                                                             |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| Settings repo | `src/server/repos/settings.ts`, `src/server/repos/__tests__/settings-map-style.test.ts` (new)                     |
| Route server  | `src/routes/_app/-server/settings.ts`                                                                             |
| Tenant guard  | `src/server/repos/__tests__/tenant-isolation.test.ts` (append only)                                               |
| Settings UI   | `src/routes/_app/-ui/basemap-picker.tsx` (new), `src/routes/_app/settings/appearance.tsx`                         |
| Copy          | the 23 `src/lib/i18n/messages/<locale>/settings.ts`, `src/lib/i18n/__tests__/parity.test.ts` (one loanword entry) |
| Copy gate     | `src/routes/_app/settings/-lib/__tests__/copy-rules.test.ts`                                                      |

## Checks

| Check                        | Result          | Notes                                                                                                                                    |
| ---------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ pass         | Clean, no suppressions added.                                                                                                            |
| `pnpm lint`                  | ✅ pass         | ESLint clean over the whole tree.                                                                                                        |
| `pnpm test`                  | ✅ pass         | 5601 tests / 232 files. Two red runs on the way here, both real and both fixed — see **Two tests that caught this change** below.        |
| `pnpm build`                 | ✅ pass         | Built in 2.15s; the server-fn manifest still resolves all 129 registrations. Run because 2.5 mounts a new component on a shipped screen. |
| `pnpm generate-routes` drift | ⏭️ not re-run   | No route file added or renamed since checkpoint 1; the final gate runs `check-generated.sh` in full.                                     |
| `pnpm db:generate` drift     | ⏭️ not run here | No schema change is in scope; `drizzle/` is untouched.                                                                                   |
| Browser evidence             | ✅ captured     | Four resting frames plus a three-frame A/B proof. See below.                                                                             |

## Browser evidence — the change is real, and so is the fix

The environment came up through `.ai/scripts/test-env-up.sh` on `http://127.0.0.1:3034` (ports
3030-3040 are the only range `playwright.config.ts` accepts outside CI; the bootstrap server on
`:3001` is deliberately not photographed). Frames captured with `scripts/visual/capture.mjs`, which
is what ADR 0016 leaves as the whole of the visual judgement. `captureValid: true` on every run and
no fatal console output on the settings screen.

1. **`/settings/appearance`, resting, 1440 and 360, light and dark.** The Map style row is a
   five-card radio grid: 3 columns at `lg`, 1 at 360. `Follow the workspace` is checked, with the
   brand border, the `--color-brand-subtle` fill and the `animate-pop-in` badge.
2. **The dark frame is the one to read.** Paper's swatch is _light_ in the dark theme while
   Automatic's swatch is _dark_ — the two entries whose whole point is that Paper is no longer
   theme-bound, proving it at swatch size before the reader ever opens a map.
3. **The checked card's swatch stays its own colour.** `RadioCard`'s icon wrapper carries
   `group-data-[state=checked]:bg-brand`, and both swatch kinds paint an opaque `size-9` tile over
   it. The trap the spec named is closed and the frame shows it.
4. **The A/B pair on `/atlas`, both in the light theme, same camera, same layers.** With Charcoal
   saved the water is charcoal under a light chrome; with Follow the workspace it is the workspace's
   pale `planned-light` water. Land stays light in both because that is the atlas's own choropleth
   painted over the basemap, exactly as the spec's **Visual change expected** table says. This is the
   frame the spec calls the proof that the preference is _read_ rather than inferred, and before this
   change neither frame would have differed from the other.
5. **The defect fix, checked at the column rather than at the pixel.** After pressing
   `Follow the workspace`, `select map_style, typeof(map_style) from user_settings` returns `null` /
   `"null"` for every row. The old handler collapsed `''` onto `undefined`, so that press wrote
   nothing and the member kept whatever id they already held — a pinned snapshot. It now clears.

`e2e/basemap-preference.spec.ts` (Step 2.6) turns items 4 and 5 into committed assertions; this
checkpoint is the manual proof that the flow works before the spec is written against it.

## Two tests that caught this change

Neither was foreseen in the plan, both were right, and both are recorded because they are the
interesting part of this window.

- **`src/lib/i18n/__tests__/parity.test.ts` — Catalan.** Catalan writes `Paper` exactly as English
  does, and the parity gate reads a byte-identical value as untranslated copy. Step 2.4 worked around
  it with `Paper clar`, which is precisely what the `LOANWORDS` docblock says not to do ("the
  alternative was to invent a second word a native speaker would not use") and which also re-attaches
  the light theme to a name the spec renamed _because the entry is no longer theme-bound_. Corrected
  in `1007e46e`: `ca` reads `Paper`, and `settings.appearance.map.paper` joins `LOANWORDS.ca` — a
  visible decision, which is the point of that list.
- **`src/routes/_app/settings/-lib/__tests__/copy-rules.test.ts` — the orphan check.** Moving the Map
  style row out of `appearance.tsx` moved ten `settings.appearance.map.*` keys' only reader to
  `_app/-ui/basemap-picker.tsx`, outside the directory that gate walks, so they read as dead copy.
  Fixed in `b5f86ff6` by registering the picker the way the gate already registers `settings-nav.tsx`
  and `plan-copy.ts` — both also settings-module copy that lives outside `settings/`. The picker now
  also sits under that module's English-literal and RTL-mirroring gates, which is a gain rather than
  an accommodation: the file's assertion count went 75 → 80.

## Step review (`engine.stepReview: checkpoint`)

Reviewed `ce04f734..b5f86ff6` against the `om-code-review` checklist. **No blocker or major
findings.** Three decisions a reviewer should see, all recorded rather than silently taken:

- **`saveAppearance`'s validator is piped, not the bare union the spec prints.**
  `z.string().trim().pipe(z.union([z.literal(''), z.enum(BASEMAP_IDS)])).optional()` rather than
  `z.union([z.literal(''), z.enum(BASEMAP_IDS)]).optional()`. The bare union makes the validator's
  _input_ type `'' | BasemapId`, and at the time Step 2.1 landed the screen still drove it from a
  `SimpleSelect` whose `onValueChange` yields `string` — red typecheck on a file that Step belonged
  to. The pipe is the shape `localeOverride` already uses in the same module. Now that the typed
  picker has landed the prefix could be dropped; it is left as a one-line follow-up rather than
  churned in a Step that is already about something else.
- **`AppearancePayload.workspaceMapStyle` now has no reader.** Both call sites were in
  `appearance.tsx` — the follow-the-workspace guess and the write-back — and `mapStyleOverride` plus
  the `''` sentinel replaced them. It is deliberately not deleted: the field predates this run, the
  merged spec enumerates the payload and keeps it, and removing a field from a spec-defined contract
  is a reviewer's call rather than an unattended run's. Two-line follow-up if wanted.
- **The picker is not wrapped in `SettingsRow`.** That row clamps its control to `shrink-0 sm:w-64`
  (`settings-nav.tsx:219`) — right for a switch or a select, impossible for a five-card grid. The
  label and hint keep the row's own type scale and rhythm; the grid takes the section's full width
  beneath them. The motion switch above stays a real `SettingsRow` and keeps its divider.

Carried forward from checkpoint 1 and still open for the reviewer: the `poiLabels` precedence
decision in `buildStyle`.

Minor, deferred to the final review: none recorded.

## Plan deviation, unchanged since it was taken

The spec's eleven Steps are ten here. Its Step 8 (copy) and Step 9 (picker) land in one commit
because they cannot land apart: `coverage.test.ts` enforces an exact `DEAD_KEYS = 9` budget that nine
reader-less keys would break, and `MessageKey` is derived from the `en` catalogue so a component
cannot name a key that does not exist yet. Its Step 10 (mount) absorbs the removal of the two retired
theme-bound keys for the same reason in the other direction. `DEAD_KEYS` was not touched and still
reads 9.
