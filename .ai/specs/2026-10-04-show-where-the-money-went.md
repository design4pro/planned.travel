# Show where the money went, drawn by hand

| Field              | Value                                          |
| ------------------ | ---------------------------------------------- |
| **Status**         | ready                                          |
| **Issue**          | none                                           |
| **Spec PR**        | none                                           |
| **Implementation** | none                                           |
| **Plan**           | 04-S4 (docs/plans/04-budget-and-currencies.md) |

## 📝 TLDR

Plan stage `04-S4` closes the last part of reference row `MNY-04` on the costs tab
(`/trips/$tripId/costs`): a **category donut** that replaces the "By category" list in the rail, a
**per-member proportional bar** on the "Total trip spend" tile, and the **link between a legend row
and its segment**. Nothing is stored and nothing is fetched: every figure already arrives in the
`loadCosts` payload. Everything is hand-written SVG and flex over tokens that exist today, because
`docs/SPEC.md` §3 freezes the dependency set. The stage is cut into three slices a ticket run can
take one at a time: the donut in the rail, the legend link, the member bar.

This spec describes the work that is **left** at HEAD (`b4025bb7`), and it departs from the plan's
stage block in places where the plan was written before ADR 0016, before the code, or before a
specialist looked at it. Every departure is a row of the Resolved assumptions table.

## 📝 Problem Statement

Today (`MNY-04` is `partial`):

- `-costs/stat-tiles.tsx` gives four figures from real aggregates, the fourth on the one inverse tile
  with a `Sparkline` already fed by `dailySeries`.
- `-costs/rail.tsx` `ByCategory` lists categories with a proportional bar each. It colours a row by
  `swatchFor(index)` where `index` is the row's position **after sorting by spend**
  (`src/routes/_app/-lib/tone.ts:177`), so a category changes colour when totals reorder, and with
  six swatches for eight categories two pairs share a colour.

Missing, and what a traveller who shares a trip's money asks of this tab: _what did we spend it on,
as a shape I can take in at a glance, and who is it split between?_ There is no donut, no per-member
breakdown on the total tile, and nothing ties a legend row to a segment.

A hand-drawn chart usually fails where it matters: it is a picture the keyboard cannot reach and a
screen reader cannot read. This design starts from that.

## 📝 Proposed Solution

### What the stage owns and what it does not

| Owned (this stage writes it)                                                                                    | Not owned (read only, or left alone)                                                    |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/components/costs/chart-geometry.ts` — new, pure                                                            | `src/routes/_app/trips/$tripId/-costs/screen.tsx`, `skeleton.tsx`, `categories.tsx`     |
| `src/components/costs/category-donut.tsx` — new                                                                 | `src/routes/_app/-lib/tone.ts` (the swatch list; `04-S2` owns the palette)              |
| `src/components/costs/member-bar.tsx` — new                                                                     | `src/styles/tokens.css`, `src/styles/styles.css`                                        |
| `src/components/costs/__tests__/chart-geometry.test.ts`, `category-donut.test.tsx`, `member-bar.test.tsx` — new | `package.json`, `pnpm-lock.yaml` (frozen, `docs/SPEC.md` §3)                            |
| `src/components/costs/index.ts` — edit (the barrel; this stage is its only wave-2 claimant)                     | `src/server/**` — no repository change, no server function, no Zod schema, no migration |
| `src/routes/_app/trips/$tripId/-costs/rail.tsx`, `stat-tiles.tsx` — edit                                        |                                                                                         |
| `src/lib/i18n/messages/<locale>/costs.ts` — edit, **all 23 locales**                                            |                                                                                         |

The plan's `e2e/budget-and-currencies.visual.spec.ts` and `e2e/__screenshots__/` are **struck**: ADR
0016 removed screenshot baselines (`toHaveScreenshot`, `e2e/__screenshots__`) and the visual
judgement is the blind A/B pair (`scripts/visual/capture.mjs`). No path under `e2e/` is touched.
No other wave-2 stage may add a module to `src/components/costs/` (the barrel collision the plan
describes); `04-S5` ships its dialog route-locally.

### The category donut

`CategoryDonut` is presentation only: plain props, no data fetching, no import from `src/server`
(`docs/SPEC.md` §6). It takes rows and a currency; it converts nothing and knows nothing about a
tenant. The figures are in `payload.currency`, which is whatever `loadCosts` hands the screen; the
rule "convert once, in `loadCosts`" belongs to the display-currency stage (`04-S1`) and the donut
simply never converts.

```ts
interface DonutRow {
  readonly key: string // the category; also the stable-colour key
  readonly label: string // already localised by the caller
  readonly spentMinor: number // integer minor units
  readonly plannedMinor: number // integer minor units, 0 when there is no budget line
  readonly colour: string // an opaque CSS colour value, e.g. 'var(--color-brand)'
}
```

**Geometry** lives in `chart-geometry.ts`, pure and unit-tested, so no browser is needed to prove
the arithmetic:

- `ringGeometry(rows)` returns `{ kind: 'empty' } | { kind: 'invalid' } | { kind: 'ring', segments }`.
  Only rows with `spentMinor > 0` become segments. A total of `0` is `empty` (never a division by
  zero). A negative or non-finite value anywhere is `invalid`.
- Angles are computed from the integer minor units, never from a formatted string. The segments'
  sweeps sum to exactly 360°, with no gap and no overlap; the visual gap between neighbours is a
  1.5px stroke in the card surface colour, not missing degrees.
- A **single** segment is a full ring and is emitted as two 180° arcs, never as a degenerate
  start-equals-end path.
- A segment worth less than 0.5° still gets a 0.5° sweep; the other segments are scaled down
  together so the ring still closes.
- `allocatePercents(values)` returns whole percents that sum to exactly 100, the residue going to
  the largest segment. The donut legend and the member bar both use it: **one owner for "share of a
  whole as a whole percent"**. A real share below 1% is shown as `<1%` (copy below), never as `0%`.
- Segment order is `EXPENSE_CATEGORY_ORDER` (`-costs/categories.tsx`), **not** spend order, starting
  at 12 o'clock and running clockwise. A segment therefore never jumps when a total changes, and
  the two category pairs that share a swatch today sit apart.

**Colour.** `colour` is opaque to the component: it contains no hex, does not import `tone.ts`, and
knows nothing about `CATEGORY_SWATCHES`. `rail.tsx` derives it from the stable position of the
category in `EXPENSE_CATEGORY_ORDER` (not from the spend-sorted position `ByCategory` uses today)
through the existing `CATEGORY_SWATCHES` list, mapping `bg-<name>` to `var(--color-<name>)` — no
second list of hues. A category string outside the enum (a retired one on an old row) takes the
colour of `other`, as `categoryLabel` already labels it `Other`. The existing per-row bars are gone
with the list, so one category has one colour across ring, legend and dot.

Until `04-S2` lands, two categories share a swatch (six swatches, eight categories). That is not an
accessibility failure — colour is never the only channel, every legend row carries its name,
percent and amount as text — and it is a one-call-site change when `04-S2` files `--color-data-1…8`:
only the colour derivation in `rail.tsx` is replaced. `04-S2` is **not** a precondition of this
stage, and no ticket here is `Blocked by` it.

**The rail panel.** `ByCategory` keeps its `Panel` (`label` "By category", `count` the total
spend, the budget `Progress` footer unchanged — the budget progress lives nowhere else on the
screen, `stat-tiles.tsx:120-122` says so) and its body becomes `CategoryDonut`. Nothing of the old
list stays. The per-row "planned" sub-line moves into the legend row and, being hardcoded English
today (`rail.tsx:385`), becomes a catalogue key.

**The legend** is a real `<ul>` with an accessible name. A row for a category with spend is a
`<button type="button" aria-pressed>` carrying `data-part="donut-legend-row"`; its **visible text is
its accessible name**: category, whole percent, amount, and the planned amount when there is one.
A category with a planned amount and no spend is a plain `<li>` (it has no segment to highlight),
listed after the spending rows. Rows are at least 24×24px and their focus ring is not clipped by
the `Panel`. Legend order is `EXPENSE_CATEGORY_ORDER`, the same as the ring.

**Reading the ring.** The SVG ring is `aria-hidden` and has **no focusable segments**. The legend is
the one set of focus stops (at most eight, not sixteen), and its text is the text alternative; there
is no second, visually hidden table, because it would read every figure twice, and no
`aria-controls`, because it would point at a hidden element. No figure exists only in a tooltip, and
this stage adds no `Tooltip`: it does not open on a touch tap.

**The link, both ways** (slice 2): hovering a legend row with a mouse, focusing it, or pressing it
highlights its segment; hovering a segment with a mouse highlights its row. Pressing a row **pins**
its highlight (`aria-pressed="true"`); pressing it again, or another row, moves or clears the pin.
A transient hover or focus shows its own segment while a pin is held. The highlight dims every other
segment with **opacity only**; colour is never the only link. Pointer handlers act only when
`pointerType === 'mouse'`, so a touch never leaves a highlight stuck on, and the press is the touch
path. Motion is one 150ms opacity transition on `--ease-out-quint`, collapsed by the existing
`prefers-reduced-motion` rule in `styles.css`. There is no entrance sweep (Resolved assumption 8).

**States.** `spentMinor === 0` over the rows → an empty card on `--color-surface-2` with the existing
`costs.categories.empty` copy and **no action** (the ledger's "Add the first expense" and the
header's "Add expense" are already on screen; threading a third button would need an `onAddExpense`
prop from `screen.tsx`, which this stage does not own). The empty test is `spent === 0`, not
"no expenses", because a zero-amount expense can be saved (`minorSchema` has `.min(0)`): the card
must never say "nothing logged" beside a ledger with rows. Planned-only categories stay listed under
the empty text, because the list they replace showed them. `invalid` → one line of text ("can't be
drawn as a chart"), no ring, and the full legend as text; **no retry button**, since a retry reloads
the same data and fails the same way. A failed load is the route's `errorComponent` (`CostsError`,
which already retries through `router.invalidate()`). There is no `pending` prop and no skeleton
inside the card: the component never renders before the loader has resolved, so the prop would be
dead code; the route's `CostsSkeleton` covers loading and is `04-S2`'s file.

### The per-member bar

`MemberBar` sits in the footer of the inverse "Total trip spend" tile, above the existing
"Your share / You paid" pair, which stays. It divides the trip's spend by **each member's
`shareMinor`** (`snapshot.balances`) — who the money was spent on — not by what each paid, which
the "Outstanding" tile and the Balances panel already say.

- Widths are measured against `spentMinor`, never against the sum of shares. When shares fall short
  (an expense can have no participants, `src/server/fns/costs.ts:197`), the gap is one neutral
  **"Not split"** segment, so the bar never overstates anyone. Should shares ever exceed the spend
  (an optimistic overlay mid-write), the widths are measured against the sum instead.
- Members with `shareMinor === 0` are left out. Past four people the bar shows the top three by share
  and one **"N others"** segment, so the tile is bounded at five segments. A removed traveller
  carries the existing `costs.person.removed` label. The viewer is "You" (`costs.person.you`).
- The bar is not drawn when fewer than two segments result: a bar of one colour says nothing.
- Segments are monochrome tints of `--color-inverse-on` at stepped opacities, with a 2px gap in the
  tile's ground colour; "Not split" is an outline segment. The data palette is deliberately **not**
  used here: it would have to clear 3:1 on white _and_ on near-black, and it would put one colour on
  a category and a traveller on the same screen. Both inverse grounds are checked — `--color-inverse`
  is `#16150f` in light and `#16221d` in dark (`tokens.css:88`, `:309`, `:447`) — and each tint
  must be at least 3:1 (WCAG 1.4.11) against both, with a floor of about 40% opacity.
- Layout uses flex and logical properties only (no `left`/`right`/`origin-left`), so the bar mirrors
  in `ar`.
- The bar is `aria-hidden`; the members are a real list beneath it in `text-inverse-on` /
  `text-inverse-muted`, each row a small `Avatar` (`size="xs"`), the name and the whole percent.
  `AvatarStack` is not used: its `role="group"` would announce every name a second time.

### Alternatives considered, and why they lost

| Alternative                                      | Lost because                                                                                                                           |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| A charting package                               | `docs/SPEC.md` §3 freezes the dependency set; `11-S2` already recorded the row as buildable without one.                               |
| Block this stage until `04-S2` files the palette | `04-S2` has no spec and no issue; a run cannot attach `Blocked by` to an issue that does not exist, so the stage would stall silently. |
| File `--color-data-*` here                       | A concept owned by `04-S2` (`docs/SPEC.md` §8), and `tokens.css` is in none of this stage's paths.                                     |
| Every segment and every row focusable (the plan) | Up to 16 tab stops; a half-degree path is an unusable pointer target (2.5.8); `aria-controls` onto a hidden ring gives AT nothing.     |
| Keep the old list beside the donut               | The same category figures drawn twice for no reader benefit; the plan says the list is the partial state the donut completes.          |
| Member bar by what each member _paid_            | Needs an "unclaimed" segment that repeats the "Outstanding" tile next to it; Balances already shows paid against share.                |

## 📝 Architecture

- **Owner of each new concept** (`docs/SPEC.md` §8): ring geometry and whole-percent allocation —
  `src/components/costs/chart-geometry.ts`; the ring and its legend — `category-donut.tsx`; the
  member segmentation and the bar — `member-bar.tsx`; the category → colour derivation — `rail.tsx`
  (the only caller, and the file `04-S2` re-points).
- **Seams.** `components/costs` imports nothing from `src/server` and nothing from `src/routes`
  (the existing module header says so). `rail.tsx` and `stat-tiles.tsx` are the only callers: they
  translate labels (`categoryLabel`, `nameOf`) and hand over finished rows.
- **No server change.** No repository function, no server function, no Zod schema, no table, no
  migration, no quota (`resolveLimits()`/`PLAN_QUOTAS` untouched).
- **Tenant isolation.** Every figure arrives through `loadCosts`, whose aggregates are already
  `organization_id`-scoped in `src/server/repos/expenses.ts` through `tenantFilter()` and covered by
  the existing cases in `src/server/repos/__tests__/tenant-isolation.test.ts`. This stage writes no
  row and adds no repository function, so it adds no isolation case — a statement, not an omission.
  The one thing it must not do: import from `src/server/**` in a component.
- **No `pnpm generate-routes`**: no route is added or edited.

## 📝 Data Model

None. Money stays integer minor units paired with a `text(3)` ISO-4217 currency; percentages are
derived at render time and never stored.

## 📝 API Contracts

None. The new components' contracts are their props (`DonutRow` above; `MemberBar` takes
`{ members: ReadonlyArray<{ userId, name, image, shareMinor }>, spentMinor, currency? }` and returns
the bar plus its list) and the pure functions of `chart-geometry.ts`.

## 📝 UI/UX

- **Rail, "By category" panel.** Donut about 10rem across (a fixed size, `mx-auto`, never stretching
  with the column), the legend below it. The rail is 21rem wide from `xl` and full width below, so
  the ring and its legend are stacked at every width and the ring never becomes a decorative void
  at 2560px. Card is `--radius-xl`, `--shadow-card`, hairline `--color-edge-faint` (the `Panel`
  already is); dark re-declares its own shadow. No hex, no one-off radius, no hand-written shadow.
- **Inverse tile.** The bar and its member list in the footer, above "Your share / You paid". The
  tile must not grow taller than its row neighbours can absorb at 360px: at most five list rows.
- Every amount and percent carries `tabular-nums`; spacing from `--space-*`.
- Hover, `:focus-visible`, active (pressed) and disabled-free states on every legend row.

## 📝 Visual change expected

- Route `/trips/$tripId/costs`, **rail "By category" panel**: the list becomes a ring with a legend.
  States to capture: resting with spend in at least four categories; a single category (full ring);
  a category below 1% (`<1%`); **spend of zero** with planned lines only; no spend and no plan;
  legend row hovered; legend row pinned.
- Route `/trips/$tripId/costs`, **"Total trip spend" tile**: the member bar and list. States: three
  members with a split; more than four members ("others"); shares short of the spend ("Not split");
  a single member (no bar).
- Light and dark, at 360, 1280 and 2560 px (desktop and mobile). No other route and no other tile
  changes.

## 📝 Copy

New keys in `src/lib/i18n/messages/en/costs.ts`, each landing in all 23 locales in the same change
(`i18n-messages` skill, parity test). Money comes from `formatMoney`, percents from `formatPercent`
(`#/lib/format`), neither is a message; the existing `costs.categories.empty` is reused for the
empty card.

| Key                          | `en` text                                                          |
| ---------------------------- | ------------------------------------------------------------------ |
| `categories.legendLabel`     | `Spend by category`                                                |
| `categories.planned`         | `{amount} planned`                                                 |
| `categories.belowOnePercent` | `<{percent}` (`{percent}` is the localised one percent)            |
| `categories.invalid`         | `These figures cannot be drawn as a chart. They are listed below.` |
| `memberBar.label`            | `Who it was spent on`                                              |
| `memberBar.listLabel`        | `Share of the trip's spend per traveller`                          |
| `memberBar.others`           | plural: `{count} other traveller` / `{count} other travellers`     |
| `memberBar.notSplit`         | `Not split`                                                        |

The plural key needs every CLDR branch the locale requires (`pl`, `ru`, `uk`, `ar`, `cs`). The
legend row's name is its visible text, so no `aria-label` template (the plan's
"Food, 32 percent, 412 euros") is added.

`stat-tiles.tsx` and `screen.tsx` carry existing hardcoded English ("You owe", "Your share",
"No expenses yet", …). This stage does not move it (Resolved assumption 9).

## 📝 Edge Cases & Failure Scenarios

| Case                                              | Behaviour                                                                                     |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| One category has all the spend                    | Full ring (two 180° arcs), 100% in the legend.                                                |
| A category worth less than 0.5°                   | 0.5° floor; the others shrink so the ring closes; the legend says `<1%`.                      |
| Every expense costs 0                             | Empty card (`spent === 0`), planned-only categories still listed.                             |
| Planned budget lines, no spend                    | Empty card plus the planned rows, as the list showed them today.                              |
| Retired category string on an old row             | Labelled `Other`, takes the colour of `other`.                                                |
| Negative or non-finite figure (should not happen) | `invalid`: text line + legend as text, no ring, no retry.                                     |
| Loader fails                                      | Route `errorComponent` as today; the card is never rendered.                                  |
| Touch device                                      | No hover; pressing a row pins its highlight; no stuck state (mouse-only hover handlers).      |
| `prefers-reduced-motion: reduce`                  | The 150ms opacity transition collapses to none; the final state is the resting render.        |
| Locale `ar`                                       | Member bar mirrors (flex, logical properties); the ring keeps its clockwise-from-12 order.    |
| Shares sum to less than the spend / more than it  | "Not split" segment / widths measured against the sum.                                        |
| A member with `shareMinor === 0`; one member only | Left out; no bar when fewer than two segments result.                                         |
| Two categories share a swatch (until `04-S2`)     | Ring order keeps them apart; legend text and the highlight link disambiguate.                 |
| Optimistic write in flight                        | Rows come from `snapshot.byCategory` / `snapshot.balances`, so the chart follows the overlay. |

## 📝 Observability

None: no server path, no log line, no metric. The console must stay silent on the route.

## ✅ Acceptance criteria

1. The rail "By category" panel renders a ring whose segment sweeps total exactly 360°, in
   `EXPENSE_CATEGORY_ORDER`, with a legend of the same order; the old bar list is gone.
2. A category keeps its colour when the totals change (colour follows the category, not the sort).
3. Legend percents are whole numbers that sum to 100; a sub-1% share reads `<1%`.
4. A legend row is a `button` whose accessible name equals its visible text; the ring is
   `aria-hidden`; the number of focus stops in the card equals the number of categories with spend.
5. Hover (mouse), focus or press on a row highlights its segment; hover on a segment highlights its
   row; press pins and a second press clears; touch leaves no stuck highlight.
6. Empty, planned-only and `invalid` states render as specified; no retry, no `pending` prop.
7. The member bar divides `spentMinor` by share, shows "Not split" when shares fall short, groups
   members past four into "N others", and is absent with fewer than two segments.
8. Every member-bar tint is at least 3:1 against both inverse grounds; the bar is `aria-hidden` and
   the list beneath carries every name and percent.
9. Every new string exists in all 23 locales; `pnpm test` (parity) is green.
10. No file outside the owned paths changed; `package.json` and `pnpm-lock.yaml` untouched.
11. Zero console errors or warnings and zero layout shift after paint on the costs route.

## 📝 Risks & Impact Review

| Risk                                                                                   | Severity | Mitigation                                                                                                                 |
| -------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| Two categories share a swatch until `04-S2` files eight tokens                         | Low      | Ring order, text on every row and the highlight link; one call-site swap in `rail.tsx` later.                              |
| A tint fails 3:1 on one of the two inverse grounds                                     | Medium   | A unit test computes the composited contrast from the token values for both themes (see Phase 3).                          |
| `AvatarStack`-free list makes the tile taller at 360px                                 | Low      | At most five list rows; checked in the 360px capture.                                                                      |
| `stat-tiles.tsx` keeps hardcoded English next to new catalogue keys                    | Low      | Named follow-up (Resolved assumption 9); this stage adds no new hardcoded string.                                          |
| Seven call sites build `Intl.DateTimeFormat` with `month: 'short'` (workerd vs WebKit) | Low      | **Report only**, none is in this stage's paths; a `mobile-safari` difference of that shape is attributed, not re-recorded. |

### Out of scope

A charting grammar (zoomable axis, stacked area, brushing, an interactive multi-series legend) —
BLOCKED per `11-boundaries-and-blockers.md`: stop and report, never install. A display-currency
conversion (`04-S1`). Trip-defined categories and the palette tokens (`04-S2`). Moving the existing
hardcoded English of `stat-tiles.tsx` / `screen.tsx` into the catalogue, and the physical
`left-1/2`/`right-1/2` classes in `rail.tsx` `Balances` (`docs/SPEC.md` §9): both are existing debt,
reported here rather than edited, and each a candidate for its own ticket.

## 📋 Phasing

| Phase | Slice                                         | Demoable on its own                                                               |
| ----- | --------------------------------------------- | --------------------------------------------------------------------------------- |
| 1     | The donut replaces the "By category" list     | The rail shows a ring and a legend, stable colours, empty and planned-only states |
| 2     | The legend link: hover, focus, press and pin  | A row and its segment highlight each other, by mouse, keyboard and touch          |
| 3     | The member bar on the "Total trip spend" tile | The tile shows who the spend is split between                                     |

Three tickets for `afk-to-tickets`; each is a vertical slice through geometry, component, caller,
copy and tests, and each can merge alone.

## 📋 Implementation Plan

### Phase 1 — The donut replaces the "By category" list

1. `chart-geometry.ts`: `ringGeometry` and `allocatePercents` as specified, exported through the
   barrel, with `__tests__/chart-geometry.test.ts` written first: sweeps total exactly 360° with no
   gap or overlap; a single category is a full ring and never a degenerate path; zero total is
   `empty`; a negative or non-finite value is `invalid`; a sub-0.5° category gets 0.5° and the rest
   absorb it; whole percents sum to exactly 100 with the residue on the largest; segment order and
   the key → colour-index mapping are identical across repeated calls and unchanged when a total
   changes.
2. `category-donut.tsx`: ring, legend (`ul`, `button`/`li` rows, `data-part="donut-legend-row"`),
   the empty, planned-only and `invalid` states; `__tests__/category-donut.test.tsx` (vitest project
   `ui`, jsdom): rows are buttons whose accessible name equals their visible text, the ring is
   `aria-hidden`, the focus-stop count equals the rows with spend, planned-only rows are not
   buttons, each state renders as specified, and no retry control exists.
3. `rail.tsx`: `ByCategory` keeps `Panel`, count and the budget footer; the body becomes
   `CategoryDonut`, fed rows from `snapshot.byCategory` through `categoryLabel` and a colour derived
   from `CATEGORY_SWATCHES` by stable category position. Add the Phase 1 keys (`legendLabel`,
   `planned`, `belowOnePercent`, `invalid`) to all 23 locales.
4. Verification and docs grep (see Verification): the terms `ByCategory`, `swatchFor`, `By category`,
   `MNY-04`, `donut` across `docs/`, `.ai/`, `src/`, `CONTEXT.md`.

### Phase 2 — The legend link

1. In `category-donut.tsx`: `pinned`, `hovered` and `focused` keys; precedence transient over pinned;
   `aria-pressed` on rows; mouse-only pointer handlers on rows and segments; a 150ms opacity
   transition on the dimmed segments, no transform and no stroke-width change.
2. Tests (jsdom): pressing a row sets `aria-pressed` and dims every other segment; a second press
   clears it; pressing another row moves the pin; a `pointerType: 'touch'` pointer event highlights
   nothing; focus highlights and blur clears; hovering a segment (mouse) highlights its row.

### Phase 3 — The member bar

1. `chart-geometry.ts`: `memberSegments(balances, spentMinor)` — drop zero shares, top three plus
   "others" past four members, a "Not split" remainder, widths against `spentMinor` (or the sum when
   shares exceed it), whole percents through `allocatePercents`; tests for each case in Edge Cases.
2. `member-bar.tsx` and `stat-tiles.tsx`: the bar, the list, the tints, the outline "Not split"
   segment; logical properties only; hidden below two segments. `member-bar.test.tsx`: bar
   `aria-hidden`, list carries every name and percent, "N others" plural, viewer shown as "You",
   removed traveller label, and a contrast test that composites each tint's opacity over the
   `--color-inverse` value of **both** themes (read from `tokens.css`) against `--color-inverse-on`
   and asserts at least 3:1.
3. Add `memberBar.*` keys to all 23 locales, the plural with every branch each locale needs.

## Verification

The gate is `validation.commands` in `.ai/agentic.config.json` (`pnpm typecheck`, `pnpm lint`,
`pnpm test`, `bash .ai/scripts/check-generated.sh`, `pnpm build`), run on the last commit of every
ticket's PR. No screenshot is compared anywhere (ADR 0016), and no new `e2e/` declaration is added:
nothing here fails in a browser that a jsdom test cannot reproduce, and the existing
`trips-core.spec.ts` already opens the costs tab under `watchConsole`.

The visual judgement is the **blind A/B pair** (`docs/SPEC.md` §7 item 4, `verifying-changes` skill),
captured with `scripts/visual/capture.mjs` against a demo trip with spend in at least four
categories and at least three members, `--auth`, viewports `360x800,1280x900,2560x1440`, themes
`light,dark`: the resting frame, then `--hover '[data-part="donut-legend-row"]'`, then
`--click '[data-part="donut-legend-row"]'` for the pinned state (the script presses no keys; the
keyboard path is proved by the jsdom tests). The capture's `console` and `warnings` output goes into
the PR body; frames stay out of the repository. At 2560px the ring must not be stretched.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                                                    | Applied default                                                                                                                                                                                                                                                            | Why                                                                                                                                                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | How does the spec relate to the unmet dependency on `04-S2` (palette, category rows)?                       | Palette-agnostic components fed an opaque `colour`; `rail.tsx` derives it from today's `CATEGORY_SWATCHES` by stable position; no ticket is blocked by `04-S2`; two categories share a swatch until it lands.                                                              | Decided by the software architect sub-agent (confidence high): `04-S2` has no spec or issue to block on, `tokens.css` is not owned here (`docs/SPEC.md` §8), and only the colour call site changes later.                                                                         |
| 2   | What does the member bar divide, and what happens to the old "By category" list?                            | Each member's `shareMinor` against `spentMinor` plus a "Not split" remainder; the donut card replaces the list and keeps the budget footer and planned figures in the legend.                                                                                              | Decided by the product owner sub-agent (confidence medium, high for the list): the plan's data source is the split, "paid" repeats "Outstanding", and the budget progress exists nowhere else; widths against the sum would overstate anyone when an expense has no participants. |
| 3   | Empty and error states of a presentation-only card?                                                         | Text-only empty card on `spent === 0` (existing `categories.empty` copy, no action); a text-only `invalid` state with the legend as text; no card-level error, no retry, no `pending`.                                                                                     | Decided by the traveller sub-agent (confidence high): no `onAddExpense` is threaded (`screen.tsx` is not owned and two add buttons exist), a retry would reload the same data, and a zero-amount expense can be saved so "nothing logged" could be false.                         |
| 4   | Focus model and legibility on the inverse tile?                                                             | Legend rows are the only focus stops (`button` + `aria-pressed`, press pins); ring `aria-hidden`; no segment focus, no `aria-controls`, no hidden table, no `Tooltip`; bar in `inverse-on` tints at 3:1 on both grounds, `aria-hidden`, names in a list; no `AvatarStack`. | Decided by the accessibility specialist sub-agent (confidence high): fewer tab stops, no 0.5° pointer target, touch parity through the press, and the palette cannot clear 3:1 on both white and near-black.                                                                      |
| 5   | What replaces the plan's screenshot-baseline verification?                                                  | Vitest geometry and component tests, the blind A/B pair through `capture.mjs`, no `e2e/` change.                                                                                                                                                                           | ADR 0016 removed `toHaveScreenshot` and `e2e/__screenshots__`; `e2e/budget-and-currencies.visual.spec.ts` does not exist. One defensible answer in the repository, so no specialist was needed.                                                                                   |
| 6   | Ring and legend order?                                                                                      | `EXPENSE_CATEGORY_ORDER`, clockwise from 12 o'clock; not spend order.                                                                                                                                                                                                      | Architect condition on row 1: the colour-sharing pairs stay apart and a segment never jumps when a total changes (the plan's own stability test). The legend carries percents, so ranking by spend is not lost.                                                                   |
| 7   | Sub-1% shares?                                                                                              | Shown `<1%` (`categories.belowOnePercent`), geometry floor 0.5°.                                                                                                                                                                                                           | Default applied: `0%` beside a visible segment reads as a bug; the placeholder keeps the percent sign positioned by the locale.                                                                                                                                                   |
| 8   | Entrance sweep, stroke-width hover and `pending` skeleton from the plan?                                    | Dropped: the only motion is the 150ms opacity transition of the link highlight.                                                                                                                                                                                            | Default applied: a sweep needs keyframes in `styles.css` (not owned) or a post-hydration state flip that blanks the server-rendered ring; the plan's "transform and opacity only" rule contradicts its own stroke-width hover; the card never renders before the loader resolves. |
| 9   | Move the existing hardcoded English of `stat-tiles.tsx` / `screen.tsx` into the catalogue?                  | No; this stage adds no hardcoded string and files the rest as follow-ups.                                                                                                                                                                                                  | Default applied (surgical changes): about a dozen strings times 23 locales is a separate concept with its own owner; reported, not hidden.                                                                                                                                        |
| 10  | The workerd/WebKit `Intl.DateTimeFormat` `month: 'short'` precondition inherited by every stage of plan 04? | Disposition **report**: none of those call sites is in this stage's paths.                                                                                                                                                                                                 | Plan text, `12-verification-protocol.md` §7.2, and `docs/SPEC.md` §7 item 6; nothing in `docs/SPEC.md` lets a stage edit a file it does not own.                                                                                                                                  |
