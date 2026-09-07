# Final gate — every Tasks row `done`

**When:** 2026-09-07T21:55:00Z
**Range:** `602a3571..d0536cb2` (10 Steps, 14 commits: 10 Step commits, 2 checkpoints, 2 corrections)

## The full `validation.commands` gate, in order

| #   | Command                               | Result  | Notes                                                                                                                                 |
| --- | ------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `pnpm typecheck`                      | ✅ pass | Clean. No `@ts-expect-error`, no `any`, no suppression added anywhere in this change.                                                 |
| 2   | `pnpm lint`                           | ✅ pass | ESLint clean over the whole tree.                                                                                                     |
| 3   | `pnpm test`                           | ✅ pass | 5601 tests / 232 files. 14 of them are this change's (8 catalogue, 6 map-style schema/repo).                                          |
| 4   | `bash .ai/scripts/check-generated.sh` | ✅ pass | "No schema changes, nothing to migrate"; generated files current. `drizzle/` and `routeTree.gen.ts` untouched, as the spec predicted. |
| 5   | `pnpm build`                          | ✅ pass | Built in 2.20s; `[server-fn-manifest] 129 server functions registered, every reference resolves`.                                     |
| 6   | `bash .ai/scripts/e2e.sh`             | ✅ pass | 30 passed, 1 skipped (mobile-safari), 0 failed — **twice in a row**. See below.                                                       |

## The integration suite

This repository's integration suite **is** the Playwright suite at step 6 above — `playwright.config.ts`
plus `e2e/`, which is what CI runs and what `validation.commands` already names. There is no second
suite for `om-integration-tests` to reach for, so it was run through the repo-native entrypoint
against the shared descriptor (`.ai/qa/test-env.json`, `http://127.0.0.1:3034`) rather than
provisioned a second time. Two consecutive green full runs, 1.1m each.

### It went red first, and that is the interesting part

`e2e/basemap-preference.spec.ts` passed 8+ consecutive **standalone** runs and then failed the
**full** suite twice — taking `e2e/journeys.spec.ts:907` ("the click surface never takes the reader's
input") with it. Both failures were Playwright's flat 30s timeout, neither was an assertion.

Isolated rather than guessed: the full suite with `--grep-invert "the basemap a member picks"` is
**28 passed, 0 failed**. So `journeys:907` was collateral from contention — two atlas-heavy tests
loading MapLibre and its tiles on two workers sharing one dev server — and not a defect this change
introduced in the product.

Two fixes, both confined to the new spec:

1. The teardown's `page.goto(..., { waitUntil: 'networkidle' })` dropped to a plain `load`. A document
   still prefetching sibling routes never goes idle while the rest of the suite has the dev server
   busy, and the `waitFor` on the very next line is a stronger and deterministic signal anyway.
2. `test.setTimeout(120_000)` on the round-trip test. Four documents, two of them a live map, plus
   two writes that must land in D1 before the next document opens — that is not one document's budget.

**No assertion was weakened and no gate was relaxed.** Measured under contention the test now runs in
34.1s against its 120s ceiling; a preference that is never read still fails on `expectGround`, not on
the clock.

**One tension for the reviewer, stated rather than buried.** `om-integration-tests` carries a generic
policy that "timeouts and retries belong in the shared runner config, not in individual test files".
This repository's own e2e suite contradicts it five times — `journeys.spec.ts` uses
`test.setTimeout(WALK_TIMEOUT_MS)` at three sites and `test.setTimeout(30_000)` at a fourth, and
`i18n-runtime-parity.spec.ts:256` uses `test.setTimeout(180_000)` — with `WALK_TIMEOUT_MS`'s own
docblock making exactly the argument used above ("a ceiling and not an expectation"). The repo's
established idiom was followed, because the alternative is raising the global timeout for every test
in the suite to accommodate one heavy file. Reversible in one line if the reviewer prefers the
shared-config route.

## Design-system / style pass

- `node .claude/skills/impeccable/scripts/detect.mjs` on `src/routes/_app/-ui/basemap-picker.tsx` and
  `src/routes/_app/settings/appearance.tsx` — exit 0, **no findings**. The `impeccable` PostToolUse
  hook reported the same on every edit to `appearance.tsx` as it was made.
- Read by eye, not only scanned: four resting frames at 1440 and 360 in both themes (attached to the
  checkpoint-2 comment on the PR). The grid is 3 columns at `lg`, 2 at `sm`, 1 at 360; selection reads
  from the label, the description and the check badge as well as the colour; the checked card's swatch
  keeps its own cartography rather than turning brand.
- No new token, no change under `src/components/ui/**`. The picker composes `RadioGroup`/`RadioCard`
  and inherits `transitionBase`, `focusRing`, `disabledState` and the `animate-pop-in` badge from the
  primitive, so hover, `focus-visible`, active and disabled match every other card in the product and
  `prefers-reduced-motion` is honoured by the shared utilities.
- Radix supplies the roving tabindex, so the five cards are **one** tab stop and arrow keys move and
  select — which is the reason this is a real radio set and not five buttons behaving like one.

## What is deliberately not green

Nothing. Every command in `validation.commands` passed on the final run, and no check was skipped,
scoped down, or waived.

## Carried to the reviewer, none blocking

1. **`poiLabels` precedence in `buildStyle`** (checkpoint 1). The catalogue entry supplies `theme` and
   `roadLabels`; `poiLabels` stays `MapCanvasProps.poiLabels`. Every entry sets `poiLabels: false`,
   which is already `MapCanvas`'s own default, so reading it from the entry would change no pixel
   today while quietly retiring a prop that belongs to the screen rather than to the basemap.
2. **`saveAppearance`'s validator is piped, not the bare union the spec prints.** The bare union types
   the validator's _input_ as `'' | BasemapId`, which was red against the `SimpleSelect` still on the
   screen when that Step landed. The pipe matches `localeOverride` in the same module. Now that the
   typed picker has landed the `z.string().trim()` prefix could be dropped — a one-line follow-up.
3. **`AppearancePayload.workspaceMapStyle` has no reader left.** Both call sites were in
   `appearance.tsx`. Not deleted: the field predates this run and the merged spec enumerates the
   payload and keeps it, so removing it is the reviewer's call rather than an unattended run's.
4. **The per-test timeout tension** described under the integration suite above.

## Plan deviation, unchanged since it was taken

The spec's eleven Steps are ten here. Its Step 8 (copy) and Step 9 (picker) land in one commit because
they cannot land apart — `coverage.test.ts` enforces an exact `DEAD_KEYS = 9` budget that nine
reader-less keys would break, and `MessageKey` is derived from the `en` catalogue so a component
cannot name a key that does not exist yet. Its Step 10 (mount) absorbs the removal of the two retired
theme-bound keys for the same reason in the other direction. `DEAD_KEYS` was never touched and still
reads 9.
