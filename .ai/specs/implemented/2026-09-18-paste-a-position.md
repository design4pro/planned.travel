# Paste a position, and have both coordinate fields fill

| Field              | Value       |
| ------------------ | ----------- |
| **Status**         | implemented |
| **Issue**          | #555        |
| **Spec PR**        | #584        |
| **Implementation** | #635        |

## 📝 TLDR

A traveller who already has a position on the clipboard - out of a message, a phone's share sheet or
a hiking site - today splits it by hand into the place form's two coordinate fields. This spec adds
a pure parser for the four notations people actually paste (`src/lib/geo/position.ts`, new) and
paste behaviour on the two existing `Input`s in `PlaceDialog`: a paste that parses fills both fields,
shows the pair it read in a reserved hint line, and moves focus on. A paste that does not parse is an
ordinary paste. No provider, no server work, no schema change. It is stage `02-S5` of
`docs/plans/02-places-and-maps.md` and does **not** close `MAP-02` (`02-S13` does).

## 📝 Problem Statement

`PlaceDialog` (`src/routes/_app/trips/$tripId/-ui/plan-actions.tsx:326`) has a latitude and a
longitude `Input`, each parsed with `Number()` (`parseCoordinate`, `:286`). Pasting
`34.9671, 135.7727` into either field leaves a value `Number()` cannot read. The reader gets
"Between -90 and 90" on save and has to split the pair by hand. With
`34°58'01.6"N 135°46'21.7"E` (what Google Maps copies) or `geo:34.9671,135.7727` (what an Android
share sheet produces) they also have to do the arithmetic. Getting the halves the wrong way round
produces a pin on another continent, and nothing warns about it before save.

Nothing in the repository parses coordinate text: `src/lib/geo/` does not exist, and `src/lib/map/`
is map logic owned by other stages (PRD #437, Implementation Decision 3).

## 📝 Proposed Solution

**A parser that refuses rather than guesses, and a paste handler that only acts on success.**

1. `parsePosition(text)` reads a whole string as one of four notations and returns
   `{ lat, lng }` or `null`. It anchors to the entire trimmed input. It never searches inside
   prose, never swaps halves, and never resolves a contradiction.
2. `onPaste` on each coordinate `Input` reads `clipboardData.getData('text/plain')`. When it parses,
   the handler calls `preventDefault()`, writes both fields, shows the pair it read and moves focus.
   When it does not parse, the handler does nothing and the browser's own paste runs, so pasting a
   single number (`34.9671`) into one field keeps working exactly as today.

### The four notations

| Notation                 | Examples that parse                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| Decimal pair             | `34.9671, 135.7727` · `34.9671,135.7727` · `34.9671 135.7727` · `-33.8568 151.2153`            |
| Hemisphere-lettered pair | `34.9671 N, 135.7727 E` · `N34.9671 E135.7727` · `34.9671°N 135.7727°E` · `33.8568s 151.2153e` |
| Degrees-minutes-seconds  | `34°58'01.6"N 135°46'21.7"E` · `34° 58′ 1.6″ N, 135° 46′ 21.7″ E` · `34°58.027'N 135°46.362'E` |
| `geo:` URI (RFC 5870)    | `geo:34.9671,135.7727` · `GEO:34.9671,135.7727,12;u=35` · `geo:34.9671,135.7727;crs=wgs84`     |

### What the parser refuses

Each refusal returns `null`. The UI treats every `null` the same way: it does nothing.

- **Latitude first, always.** A two-number pair is read latitude-first, which is the order
  Google Maps, Apple Maps, OpenStreetMap's "share" and RFC 5870 all use. A pair whose first half is
  outside ±90 is **refused, never swapped**: `151.2153, -33.8568` is refused. A pair that is valid
  both ways (`-60, 70`) is read as written. Swapping it would move a point in the Southern Ocean
  (-60, 70) to Baffin Bay in the Arctic (70, -60).
- **Letters name the axis and must agree with the order.** The first half takes `N`/`S`, the second
  `E`/`W` (case-insensitive). `135.7727 E, 34.9671 N` is refused rather than reordered. Letters on one
  half only is refused.
- **A sign or a letter, never both.** `-51.5 N` is a contradiction and `-51.5 S` is a double
  negative. Both are refused.
- **Ranges.** Latitude within ±90, longitude within ±180, inclusive. Minutes and seconds are `< 60`.
  With minutes present the degrees must be an integer, and with seconds present the minutes must be
  an integer too: `34°58.5'30"N` counts the half-minute twice and is refused.
- **`geo:` with a query is refused.** Android's `geo:0,0?q=34.96,135.77(Fushimi Inari)` puts the
  real position in the query and `0,0` (Null Island) in the path. A `crs` other than `wgs84` is also
  refused. Altitude and the `u` parameter are accepted and discarded.
- **Anything else in the string.** `Meet at 12, 30 people` does not parse, because the grammar must
  match the whole trimmed input. Decimal commas (`34,9671 135,7727`) are refused because the comma
  is also the pair separator. A string longer than 256 characters is refused before any pattern
  runs.

### Alternatives considered, and why they lost

- **A `components/ui` coordinate widget.** It would be a second implementation of `Input` and a new
  primitive that PRD #437 Decision 7 routes to `00-foundations.md`. This is behaviour on two inputs
  that already exist.
- **Parse on `change` or `blur` as well as on paste.** Typing is not a notation: a reader halfway
  through `34.9` would see the field rewritten under them. Paste is the one moment the whole string
  arrives at once.
- **A library (e.g. `coordinate-parser`, `geo-coordinates-parser`).** The stack is pinned
  (docs/SPEC.md §3). Four anchored grammars are about a hundred lines, and those libraries are built
  to guess ("smart" swap, prose extraction), which is what this design refuses to do.
- **Auto-swap an out-of-range pair.** This is the one "helpful" behaviour the issue rules out. A
  silent swap is a wrong answer that looks right.

## 📝 Architecture

One new concept, "coordinate text → a lat/lng pair", with one owner (docs/SPEC.md §8):

- **`src/lib/geo/position.ts` - new.** It owns the grammar, the refusals and the normalised string
  form. It is pure and isomorphic, with no dependency and no DOM. It lives in `src/lib/geo/`, not in
  `src/lib/map/`: this is text parsing, not map logic, and the map directory belongs to other stages
  (Decision 3).
- **`src/routes/_app/trips/$tripId/-ui/plan-actions.tsx` - `PlaceDialog`, edited.** It owns the
  paste behaviour, the hint line and the focus move. It is the only consumer. It publishes
  `data-part="place-lat"` and `data-part="place-lng"` (reserved to `02-S5` in the plan's hook
  registry).
- **`src/lib/i18n/messages/*/trips.ts` - one new key** (see Copy).

Unchanged: the save path (`createPlanPlaceFn` / `updatePlanPlaceFn`), which already validates each
coordinate with `latitudeSchema` / `longitudeSchema` (`src/server/repos/places.ts:58-87`).
**The client parser is a convenience, never a validation.** A hand-crafted request is rejected by the
same schema whether or not anything was pasted, and that division does not move.

"Position" here means a geographic lat/lng pair. `CONTEXT.md` uses "position" for a stop's place in
a day's order. The module name follows the issue and the plan. The exported type is `GeoPosition`,
so the two senses never share an identifier.

## 📝 Data Model

None. No table, column, migration, preference or storage. `places.lat` / `places.lng` are unchanged.

## 📝 API Contracts

No server function, repository function or Zod schema changes. The one new contract is in-repo:

```ts
// src/lib/geo/position.ts
export interface GeoPosition {
  readonly lat: number
  readonly lng: number
}

/**
 * Reads the whole of `text` as one position in one of four notations — a decimal pair,
 * a hemisphere-lettered pair, degrees-minutes-seconds, or an RFC 5870 `geo:` URI — and
 * returns it, or `null` when the text is not exactly one of those. Never swaps halves,
 * never resolves a sign/letter contradiction, never extracts numbers from prose.
 */
export function parsePosition(text: string): GeoPosition | null

/**
 * The string a coordinate field holds after a paste: at most six decimals (~0.1 m),
 * trailing zeros dropped, a `.` decimal point, never exponent notation. `Number()` of the
 * result is the rounded value, so the existing `parseCoordinate` reads it unchanged.
 */
export function formatCoordinate(value: number): string
```

Implementation constraint: every pattern is anchored and has no nested or adjacent unbounded
quantifiers, so matching costs linear time in the input. The 256-character cap means a longer paste
never reaches a pattern at all. The two are pinned separately: the 100,000-character test pins the
cap, and a near-cap pathological string per notation pins the patterns (Implementation Plan, step 1).

## 📝 UI/UX

**The coordinate pair in `PlaceDialog`, create and edit modes alike.**

- **Paste that parses, into either field.** Both fields take `formatCoordinate(lat)` /
  `formatCoordinate(lng)`, replacing whatever they held. The hint line under the pair reads
  "Read as latitude 34.9671, longitude 135.7727". Focus then goes to the **longitude** field with
  the caret at the end: from latitude it moves across, and from longitude it stays where it is. The
  reader's attention ends on the half that changed without their typing, next to the line that says
  what was read.
- **Paste that does not parse.** Nothing custom happens: no `preventDefault()`, no message, no
  clearing. The browser inserts the text as it does today, and the existing save-time validation
  ("Between -90 and 90", "A position needs both numbers") still applies. A field that shouts or
  erases itself on a half-typed number is worse than no help.
- **After a successful paste the reader edits a field by hand.** The hint clears on the next
  `change` of either field, because it described values that are no longer both there. The reserved
  box stays (see below), so clearing it moves nothing.
- **Reopening the dialog** resets the hint along with the draft (the existing `useEffect` on
  `open`).

**The hint line.** It is a `<p>` directly under the two-column grid, spanning both columns, in the
`FieldHint` look (`text-caption text-ink-3`) plus `tabular-nums`. Its box is **reserved whether
or not it has content**: two caption lines below the `sm` breakpoint and one from `sm` up
(`min-h-[2lh] sm:min-h-lh`). A hint that appears under a field is the classic layout shift, and on
mobile the pair stacks and anything below would jump. Two signed six-decimal numbers in a long
locale do not fit one caption line at 360px, so the narrow reservation is two lines. The copy is
held to that box: every locale's string, filled with `-33.856812` and `-151.215312`, fits two
lines at 360px and one line at the `sm` dialog width, and a translation that does not is shortened
rather than clamped, because the numbers are the point of the line. It sits under the
pair rather than under one field because it describes both halves, and because `Field`'s own `hint`
slot renders nothing when empty, so it cannot reserve space without changing `components/ui` (out of
scope). The latitude field keeps its existing hint ("Or close this and pick the spot on the map.").

**Assistive technology.** Both inputs pass `aria-describedby={pastedHintId}`, which
`useFieldControl` merges ahead of the `Field`'s own hint and error ids. The line is announced when
either field is focused, not merely visible. The line is also `role="status"` (polite, as
`FieldError` is), so a paste into the longitude field, where focus does not move, is still
announced. A paste into latitude may announce twice (status, then description on focus). This is
accepted: the second announcement is the reader's confirmation on the field they land on.

**Keyboard and touch.** Paste is the platform gesture (`Ctrl/Cmd+V`, the context menu, the iOS
callout). The design adds no shortcut and no button. `inputMode="decimal"` stays, because typing
remains decimal, and a paste bypasses the soft keyboard.

## 📝 Visual change expected

- **`/trips/$tripId/plan` → "Add a place" and a place's "Edit" → the place dialog, at rest.** An
  empty reserved box appears under the latitude/longitude pair, so everything below it (the
  "Put it on a day" select in create mode, the dialog footer) sits lower than today: one caption
  line on desktop, two on mobile. Light and dark. On desktop the pair is two columns and the box
  spans both. On mobile the pair stacks and the box follows the longitude field.
- **Same dialog, after a successful paste.** Both fields show the normalised numbers, the reserved
  line shows "Read as latitude …, longitude …" in `tabular-nums`, focus is on longitude, and nothing
  moves. Light and dark, desktop and mobile.
- **Same dialog, after a paste that does not parse.** Identical to today: the pasted text sits in
  the field.
- No other route changes.

## 📝 Copy

One new key. The failure path is silent by design, so it has no message.

| Key (`en`)                        | Text                                      |
| --------------------------------- | ----------------------------------------- |
| `trips.plan.place.pastedPosition` | `Read as latitude {lat}, longitude {lng}` |

`{lat}` and `{lng}` are the `formatCoordinate` strings, passed through unformatted. The fields
require a `.` decimal point, so the hint shows the numbers exactly as the fields hold them, even
in locales whose decimal separator is a comma. The key lands in all 23 locales in the same change
(`i18n-messages`). `PlaceDialog`'s existing strings are hardcoded English. Moving them into the
catalogue is not this stage's work (see Out of scope), but the new string does not join them.

## 📝 Edge Cases & Failure Scenarios

- **A paste into a field that already holds a partial number.** On success both fields are
  replaced, because the paste was a whole position. On failure the browser inserts at the caret, as
  today.
- **A pasted single number** (`34.9671`) is not a pair, so it is refused and pasted normally. This is
  today's behaviour, unchanged.
- **Rich clipboard** (HTML from a web page) is read as `text/plain` only. An empty plain-text flavour
  is treated as a refusal.
- **Whitespace and line breaks** around or between the halves (a pair copied across two lines of a
  message) are accepted wherever the grammar allows a separator. Leading and trailing whitespace is
  trimmed.
- **Precision.** Six decimals is about 0.1 m at the equator, finer than any pin. DMS input is
  converted and then rounded, so `34°58'01.6"N` becomes `34.967111`.
- **`-0`** formats as `0`.
- **Edit mode with an existing position.** A successful paste overwrites both stored values in the
  draft. Nothing is saved until the reader saves, and Cancel discards it, as today.
- **The long paste.** Any string over 256 characters returns `null` before pattern matching, so the
  handler costs a length check.
- **Browsers without `clipboardData` on the event** (none among the supported ones) are treated as a
  refusal, and the native paste proceeds.

## 📝 Risks & Impact Review

- **Blast radius.** One pure module and one dialog, with no server, data or migration change.
  Rollback is a revert of one PR.
- **Correctness risk: a wrong answer that looks right.** A silent swap, a misread hemisphere or a
  `geo:0,0?q=` read as Null Island would all save a plausible pin in the wrong place. Each has a
  named refusal and a named unit test. The hint shows what was read before anything is saved.
- **Compatibility** (`BACKWARD_COMPATIBILITY.md`): §1 schema, §2 server-function contracts, §4 routes
  and §7 configuration are not crossed. §5, the locale catalogue, **is crossed**: one key in 23
  locales, enforced by the parity test.
- **Quota and tenancy.** No countable row and no repository function. The save still goes through
  `createPlace` / `updatePlace` and `assertQuota(scope, 'places', …)`, and no path around it is
  added. No tenant-isolation case is added because no tenant-scoped read or write is added.
- **Wave discipline.** `02-S5` owns `plan-actions.tsx` in wave 3. `02-S4` (#554) owns
  `plan-screen.tsx`, `planner-add-place.tsx`, `planner-map-layer.tsx` and `planner-day-tools.tsx`,
  and none of them is touched here. The journey opens the form through the button that exists today,
  not through a hook `02-S4` may not have landed.
- **Accessibility (WCAG 2.2).** The hint is programmatically associated (1.3.1) and announced as a
  status message (4.1.3). Focus moves only as a direct result of the reader's paste, to an adjacent
  field of the same group (3.2.2 On Input permits a change the reader initiated and can predict).
  Nothing depends on colour, and nothing moves after paint (the reserved line).

### Out of scope

- Closing `MAP-02` (that is `02-S13`), and any server work, schema change or countable row.
- A reverse lookup on the pasted position (`02-S4`'s dropped-pin address) and address completion
  (`02-S11`).
- A `components/ui` coordinate primitive, or a change to `Field` so it can reserve an empty hint
  (Decision 7).
- Any file under `src/lib/map` or `src/components/map`, and any camera change (Decisions 2 and 3).
- Parsing on typing or blur, share-link URLs (Google/Apple Maps `https://` links, which belong to
  `02-S13`'s resolution), plus codes, MGRS/UTM and decimal-comma input.
- Moving `PlaceDialog`'s existing hardcoded English into the catalogue. That is a follow-up issue,
  not part of this stage.

## 📋 Phasing

One phase. The parser alone ships nothing a reader can use, and the paste handler has nothing to
call without it. Together they are one reviewable change of one module, one dialog and one key.

## 📋 Implementation Plan

**Phase 1: paste a position into the place form**

1. **The parser, test-first.** Create `src/lib/geo/__tests__/position.test.ts`, then
   `src/lib/geo/position.ts` with `GeoPosition`, `parsePosition` and `formatCoordinate`, as in API
   Contracts. Cases:
   - Round-trips, each notation with its own exact expected pair. For Fushimi Inari the decimal,
     lettered and `geo:` forms yield `{ lat: 34.9671, lng: 135.7727 }`. `34°58'01.6"N 135°46'21.7"E`
     yields `{ lat: 34.967111, lng: 135.772694 }` and `34°58.027'N 135°46.362'E` yields
     `{ lat: 34.967117, lng: 135.7727 }`: DMS is converted and then rounded, so it lands within
     `1e-4` of the decimal pair but not on it. A south-west position (`-33.8568, -151.2153`) is
     checked in its sign and `S`/`W` forms.
   - Hemisphere letters: a letter flips the sign, and a conflicting or doubled sign-plus-letter
     (`-51.5 N`, `-51.5 S`) returns `null`.
   - Ranges: latitude 90.0001 and longitude 180.0001 return `null`, and ±90 and ±180 parse.
   - No swap: `151.2153, -33.8568` returns `null`, `-60, 70` reads as `{ lat: -60, lng: 70 }`, and
     `135.7727 E, 34.9671 N` returns `null`.
   - `geo:` URIs: altitude and `u=` are ignored, `?q=` is refused, and `crs=` other than `wgs84` is
     refused.
   - Prose, empty input and single numbers: `Meet at 12, 30 people`, `''` and `34.9671` return
     `null`.
   - Minutes or seconds of 60 or more return `null`, and so do fractional degrees with minutes
     (`34.5°58'N …`) and fractional minutes with seconds (`34°58.5'30"N …`).
   - `formatCoordinate` covers six decimals, trailing zeros, `-0` and no exponent for `1e-7`.
   - A 100,000-character string (`'1'.repeat(1e5)` and `'1, '.repeat(33_334)`) returns `null`.
     This pins the length guard only: no pattern runs on it.
   - Backtracking safety, below the cap: for each notation a pathological string of about 255
     characters (a valid prefix, a long run of the characters its repeated groups accept, and a
     trailing character that makes the match fail, e.g. `'1'.repeat(250) + ',x'`,
     `` `N${'1'.repeat(250)}x` ``, `` `34°${' '.repeat(250)}x` ``, `` `geo:${'1'.repeat(250)};` ``)
     returns `null` in under 50 ms of wall-clock time each.

   Verify with `pnpm exec vitest run src/lib/geo`.

2. **The copy.** Add `trips.plan.place.pastedPosition` to `src/lib/i18n/messages/en/trips.ts` and to
   the 22 other locales, following `i18n-messages`. `pnpm test` (parity) is the check.
3. **The paste behaviour.** In `PlaceDialog`:
   - Add `data-part="place-lat"` and `data-part="place-lng"` to the two `Input`s.
   - Add a `pasted: GeoPosition | null` state, reset in the existing open `useEffect` and on either
     field's `onChange`.
   - Add a shared `onPaste` handler: parse `clipboardData.getData('text/plain')`, and on success
     `preventDefault()`, write both draft fields with `formatCoordinate`, set `pasted`, and focus the
     longitude input through a ref (caret at the end).
   - Render the reserved `<p id={pastedHintId} role="status" className="min-h-[2lh] sm:min-h-lh text-caption text-ink-3 tabular-nums">`
     under the pair, containing `t('trips.plan.place.pastedPosition', …)` only when `pasted` is set.
   - Pass `aria-describedby={pastedHintId}` on both inputs.

   Tests: a component test beside the existing plan-actions tests, or a new
   `-ui/__tests__/place-dialog-paste.test.tsx`. Cover these cases:
   - A `fireEvent.paste` with a `geo:` URI on latitude fills both fields, shows the hint and moves
     focus to longitude.
   - An unparseable paste does not prevent the default.
   - Typing after a paste clears the hint.
   - Both inputs carry the hint id in `aria-describedby`.

4. **The journey.** Append one `test.describe('02-S5 — paste a position', …)` to
   `e2e/places-and-maps.spec.ts`, using the helpers in `e2e/helpers/places-and-maps.ts`:
   - `watchConsole()` before navigation with `fatal` asserted empty. The GL advisory on the map
     route is the one tolerated entry.
   - Open `/trips/$tripId/plan` for a demo trip.
   - Start the layout-shift recorder.
   - Click `getByRole('button', { name: 'Add a place' })`.
   - Assert `[data-part="place-lat"]` and `[data-part="place-lng"]` each `toHaveCount(1)` **before**
     anything else.
   - Dispatch a real `ClipboardEvent('paste')` carrying `geo:34.9671,135.7727` through a
     `DataTransfer` onto the latitude input.
   - Assert both values, the hint text, and that longitude is focused.
   - Assert zero layout shifts in Chromium. A synthetic event sets no `hadRecentInput`, so a shift
     caused by the hint would be counted.

   - Repeat the paste and the zero-shift assertion at a 360px viewport with the signed payload
     `geo:-33.856812,-151.215312`, so the stacked layout and the widest numbers are covered, not
     only the pinned 1440px one.

   If WebKit does not carry `clipboardData` through a constructed `ClipboardEvent`, skip the
   `mobile-safari` project for this case with that reason stated, as the existing layout-shift case
   does.

5. **Verify.** Run the gate in `.ai/agentic.config.json`. Then run the blind A/B pair
   (`scripts/visual/capture.mjs`) for the plan's `02-S5` states: `resting` (unchanged), `form-open`
   (the reserved box) and `pasted`. Capture each in light and dark, at 360 and 1280. Capture
   `pasted` with the signed six-decimal payload in `en` and in the locale whose string is longest,
   and check that the hint stays inside its reserved box.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                     | Applied default                                                                                                                                        | Why                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Where does focus go after a successful paste?                                | The longitude field: from latitude it moves across, from longitude it stays.                                                                           | The issue says "moves focus on" so the reader sees where the halves went. Longitude is the half they did not paste into, and it carries the hint's description. |
| Q2  | Where does the hint sit, given `Field` renders nothing for an empty hint?    | A reserved box under the pair (two lines below `sm`, one from `sm` up), spanning both columns, `role="status"` plus `aria-describedby` on both inputs. | It describes both halves, reserves its box without a `components/ui` change (Decision 7), and is announced whichever field was pasted into.                     |
| Q3  | May a hemisphere-lettered pair arrive longitude-first (`135.77 E, 34.96 N`)? | No, it is refused.                                                                                                                                     | Refusing is always the reversible side, since nothing changes. Real clipboards (Google, Apple, OSM, RFC 5870) are latitude-first, so this can be widened later. |
| Q4  | Does a sign combined with the matching letter (`-51.5 S`) parse?             | No: a sign or a letter, never both.                                                                                                                    | One rule instead of a "consistent vs conflicting" table, and no real source writes both.                                                                        |
| Q5  | Does degrees-minutes without seconds (`34°58.027'N`) count as DMS?           | Yes, with seconds optional.                                                                                                                            | Garmin and many hiking sites emit it, and it is the same grammar with one group optional.                                                                       |
| Q6  | Does parsing also run on typing or blur?                                     | No, on paste only.                                                                                                                                     | Rewriting a field mid-keystroke is the failure the issue warns about. Paste is the one moment the whole string is known.                                        |
| Q7  | Precision of the filled values?                                              | Six decimals, trailing zeros dropped.                                                                                                                  | About 0.1 m, beyond any pin's accuracy, and short enough to read in the hint.                                                                                   |
| Q8  | "Position" collides with `CONTEXT.md`'s stop order.                          | Keep the issue's `position.ts` / `parsePosition`, and name the type `GeoPosition`.                                                                     | The plan and the issue already use the name. The distinct type keeps the two senses apart in code without a rename across the plan.                             |
