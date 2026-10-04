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
`docs/SPEC.md` §3 freezes the dependency set. The stage is cut into three slices a ticket run takes
in order: the donut in the rail (Phase 1), then the legend link (Phase 2) and the member bar
(Phase 3), which are independent of each other and each `Blocked by` Phase 1.

This spec describes the work that is **left** at HEAD (`b4025bb7`), and it departs from the plan's
stage block where the plan was written before ADR 0016, before the code, or before a specialist
looked at it. Every departure is a row of the Resolved assumptions table.

## 📝 Problem Statement

Today (`MNY-04` is `partial`):

- `-costs/stat-tiles.tsx` gives four figures from real aggregates, the fourth on the one inverse tile
  with a `Sparkline` already fed by `dailySeries`.
- `-costs/rail.tsx` `ByCategory` lists categories with a proportional bar each. It colours a row by
  `swatchFor(index)` where `index` is the row's position **after sorting by spend**
  (`src/routes/_app/-lib/tone.ts:177`), so a category changes colour when totals reorder, and the
  ledger's own category chip on the same screen (`EXPENSE_CATEGORY_TINT`, `tone.ts:148-157`) is
  coloured by a different rule.

Missing, and what a traveller who shares a trip's money asks of this tab: _what did we spend it on,
as a shape I can take in at a glance, and who is it split between?_ There is no donut, no per-member
breakdown on the total tile, and nothing ties a legend row to a segment.

A hand-drawn chart usually fails where it matters: it is a picture the keyboard cannot reach and a
screen reader cannot read. This design starts from that.

## 📝 Proposed Solution

### What the stage owns and what it does not

| Owned (this stage writes it)                                                                                                 | Not owned (read only, or left alone)                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/components/costs/chart-geometry.ts` — new, pure                                                                         | `-costs/screen.tsx`, `-costs/skeleton.tsx`, `-costs/categories.tsx` (`04-S2` owns the category entity) |
| `src/components/costs/category-donut.tsx`, `member-bar.tsx` — new                                                            | `src/routes/_app/-lib/tone.ts` (the swatch and tint lists; `04-S2` owns the palette)                   |
| `src/components/costs/__tests__/chart-geometry.test.ts`, `category-donut.test.tsx`, `member-bar.test.tsx` — new              | `src/styles/tokens.css`, `src/styles/styles.css`                                                       |
| `-costs/chart-colours.ts` — new, and `-costs/__tests__/chart-colours.test.tsx` — new (`.test.tsx` runs in the `ui` project)  | `package.json`, `pnpm-lock.yaml` (frozen, `docs/SPEC.md` §3)                                           |
| `src/components/costs/index.ts` — edit (the barrel; this stage is its only wave-2 claimant)                                  | `src/server/**` — no repository change, no server function, no Zod schema, no migration                |
| `-costs/rail.tsx`, `-costs/stat-tiles.tsx` — edit                                                                            |                                                                                                        |
| `src/lib/i18n/messages/<locale>/costs.ts` — edit, **all 23 locales**                                                         |                                                                                                        |
| This spec's `Status` / `Implementation` rows, the regenerated `.ai/specs/README.md`, and any document the Phase 1 grep names |                                                                                                        |

`-costs/` is `src/routes/_app/trips/$tripId/-costs/`. The plan's
`e2e/budget-and-currencies.visual.spec.ts` and `e2e/__screenshots__/` are **struck**: ADR 0016
removed screenshot baselines (`toHaveScreenshot`, `e2e/__screenshots__`) and the visual judgement is
the blind A/B pair (`scripts/visual/capture.mjs`). No path under `e2e/` is touched. No other wave-2
stage may add a module to `src/components/costs/` (the barrel collision the plan describes); `04-S5`
ships its dialog route-locally.

### The category donut

`CategoryDonut` is presentation only: plain props, no data fetching, no import from `src/server` and
none from `src/routes` (`docs/SPEC.md` §6). It takes rows and a currency; it converts nothing and
knows nothing about a tenant. The figures are in `payload.currency`, whatever `loadCosts` hands the
screen; the rule "convert once, in `loadCosts`" belongs to the display-currency stage (`04-S1`) and
the donut never converts.

```ts
interface DonutRow {
  readonly key: string // the category; also what a highlight and a pin refer to
  readonly label: string // the caller's category label
  readonly spentMinor: number // integer minor units
  readonly plannedMinor: number // integer minor units, 0 when there is no budget line
  readonly colour: string // an opaque CSS colour value, e.g. 'var(--color-brand)'
}
```

**The seam for order.** `ringGeometry` and the legend preserve the order of the rows they are given.
`rail.tsx` hands them rows already sorted by `EXPENSE_CATEGORY_ORDER` (`-costs/categories.tsx`),
because `components/costs` must not import from the route. `payload.byCategory` always carries the
eight enum values, so no folding of unknown categories is needed.

**Geometry** lives in `chart-geometry.ts`, pure and unit-tested, so no browser is needed to prove
the arithmetic:

- `ringGeometry(rows)` returns `{ kind: 'empty' } | { kind: 'ring', segments }`. Only rows whose
  `spentMinor` is a positive finite number become segments; a row with anything else is treated like
  zero. A total of `0` is `empty` — never a division by zero. There is no "invalid" state: the
  repository cannot produce a negative total (`minorSchema` is `.min(0)`, the optimistic overlay
  clamps at zero), so a state, a frame and a translated string for it would never render.
- Angles are computed from the integer minor units, never from a formatted string. The **last**
  segment takes the remainder (360° minus the others), so the sweeps sum to exactly 360° in floating
  point, with no gap and no overlap; the visual gap between neighbours is a 1.5px stroke in the card
  surface colour, not missing degrees.
- A **single** segment is a full ring and is emitted as two 180° arcs, never as a degenerate
  start-equals-end path.
- Every segment gets at least 0.5°: each segment below the floor is raised to it and the segments at
  or above it are scaled down together by the same factor, so the ring still closes. The floor is
  applied once, before the remainder goes to the last segment.
- `allocatePercents(values)` returns whole integer percents that sum to exactly 100 by the
  **largest-remainder method**: floor each share, then give the leftover points one each to the
  segments with the biggest fractional parts, ties broken by row order. Every figure stays within one
  point of its real share (leaving the residue on the largest segment can misstate it by up to
  `n - 1` points: eight categories at 12.5% would show 16% on one). The donut legend and the member
  bar both use it: **one owner for "share of a whole as a whole percent"**.
- `formatSharePercent(share, allocated, locale)`, the other pure helper of that module, renders what
  a reader sees, for the donut legend and the member list alike. A share with `0 < share < 0.01`
  renders `<1%` (the glyph form, `aria-hidden`, beside a visually hidden spoken form "less than 1%",
  copy below) in place of its allocated integer; a zero share never renders `<1%`; every other share
  renders `formatPercent(allocated / 100, locale)` (`formatPercent` takes a **ratio** and clamps it
  to 1, so an integer percent must be divided by 100 first). The sum-to-100 property belongs to the
  allocated integers and is unit-tested there, not to the rendered text.
- Segments start at 12 o'clock and run clockwise, in `EXPENSE_CATEGORY_ORDER`, **not** spend order:
  a segment never jumps when a total changes.

**Colour** is the one function `categoryColour(category)` in `-costs/chart-colours.ts`: it reads the
category's own hue from `EXPENSE_CATEGORY_TINT` (the `text-<hue>` token the ledger chip already uses,
mapped to `var(--color-<hue>)`) and falls back to the hue of `other` for a string outside the enum.
The ring, the legend dot and the ledger chip are therefore the same hue by construction, and the
colour follows the category, never its position after a sort. `CategoryDonut` treats `colour` as
opaque: no hex, no import of `tone.ts`, no knowledge of the hue lists. `chart-colours.test.tsx`
asserts that every enum category resolves to a `var(--color-*)` declared in `tokens.css`, that the
result matches the ledger chip's hue for all eight, and that an unknown string resolves like `other`.

Until `04-S2` lands, two pairs of categories share a hue (`accommodation`/`insurance`,
`fees`/`other`), because the tint list has six hues for eight categories. They are separated in the
ring by the categories between them and only touch when the category between them has no spend; that
is not an accessibility failure — colour is never the only channel, and every row carries its name,
percent and amount as text — and it is **one function** to swap when `04-S2` files
`--color-data-1…8`: whoever lands that replaces the body of `categoryColour` (and claims
`chart-colours.ts`, which this stage creates). `04-S2` is **not** a precondition of this stage, and
no ticket here is `Blocked by` it.

**The rail panel.** `ByCategory` keeps its `Panel` (`label` "By category", `count` the total
spend, the budget `Progress` footer unchanged — the budget progress lives nowhere else on the
screen, `stat-tiles.tsx:120-122` says so) and its body becomes `CategoryDonut`. Nothing of the old
list stays. The per-row "planned" sub-line moves into the legend row and, being hardcoded English
today (`rail.tsx:385`), becomes a catalogue key. The category **names** are the caller's
`categoryLabel`, which is hardcoded English today (`categories.tsx:19-38`); that is existing debt
shared with the ledger and the expense dialog, owned by `04-S2`, and is not moved here (Resolved
assumption 11).

**The legend** is `<ul aria-label>`; every row is an `<li>`. In Phase 1 every row is plain text.
In Phase 2 a row with spend gains a `<button type="button" aria-pressed>` inside its `<li>`,
carrying `data-part="donut-legend-row"`. Which rows exist, and in what order: a category with spend
is a spending row; a category with no spend but a planned amount is a **planned-only** row; a
category with neither is left out (the list this replaces filtered them too). Spending rows come
first in the order given, then planned-only rows in the order given. A planned-only row is always a
plain `<li>` (it has no segment to highlight) and shows the name and `categories.planned` only — no
percent and no zero amount — so its accessible text is, for example, `Insurance, €200.00 planned`.
A spending row's content, in DOM and reading order: the category name, the percent, the amount, then
the planned amount when there is one; laid out on two lines (dot, name, amount on the first; percent
and planned on the second), the **name wraps and is never cut off**. Separators are visually hidden
punctuation, so the accessible name of a spending row reads, for example,
`Food & drink, 32%, €412.00, €500.00 planned`, and for a share under 1% the spoken form,
`Fees & charges, less than 1%, €3.00`; the component test asserts those exact strings (with the
locale's own formatting). Rows are at least 24×24px and their focus ring is not clipped by the
`Panel`.

**Reading the ring.** The SVG ring is `aria-hidden` and has **no focusable segments**. The legend is
the one set of focus stops (at most eight, not sixteen) and its text is the text alternative; there
is no second, visually hidden table, because it would read every figure twice, and no
`aria-controls`, because it would point at a hidden element. No figure exists only in a tooltip, and
this stage adds no `Tooltip`: it does not open on a touch tap. When no ring is drawn (`empty`) there
is no button anywhere in the card.

**The link, both ways** (Phase 2):

- **Hover** (mouse only, `pointerType === 'mouse'`) over a row highlights its segment, and over a
  segment highlights its row. **Keyboard focus** on a row highlights its segment **only when the row
  matches `:focus-visible`**: focus that arrives from a click or a tap highlights nothing, because
  browsers focus a pressed button and the highlight would otherwise stay stuck after the pin is
  cleared. jsdom's support for `:focus-visible` is checked in the test; if it is absent the test
  stubs `matches`.
- **Press** pins: `aria-pressed="true"`; pressing the row again, or another row, clears or moves
  the pin. A transient hover or keyboard focus shows its own segment while a pin is held. A pin on a
  category that no longer has spend is cleared in the same render.
- A highlight dims every other segment to **0.35 opacity** and changes nothing else on the ring
  (opacity only, no transform, no stroke-width); colour is never the only link, because the row
  carries a visible state too:
  - a row highlighted from its **segment** (mouse over the arc) gets the hover ground `bg-surface-2`;
  - a **pinned** row gets `bg-surface-inset` plus a 1px inset line in `--color-ink-3` drawn as an
    inset box-shadow (`ring-1 ring-inset`), **not** an `outline`, which is the property the system
    focus ring uses and would compete with it on a pinned row that has keyboard focus (at least 3:1
    against the resting row in both themes, WCAG 1.4.11) — a different look from hover, and not
    carried by colour alone;
  - `:focus-visible` keeps the system focus ring.
- Motion is one transition of `opacity` over `--duration-fast` (150ms) on `--ease-out-quint`.
  Under `prefers-reduced-motion` the existing rule in `styles.css` collapses the **transition**; the
  dim to 0.35 still applies, instantly, because the link between row and segment is the feature, not
  the motion. There is no entrance sweep (Resolved assumption 8).

**States.** `spentMinor === 0` over the rows → an empty card on `--color-surface-2`, with **no
action** (the ledger's "Add the first expense" and the header's "Add expense" are already on screen;
threading a third button would need an `onAddExpense` prop from `screen.tsx`, which this stage does
not own). The empty test is `spent === 0`, not "no expenses", because a zero-amount expense can be
saved (`minorSchema` has `.min(0)`): the card must never say "nothing logged" beside a ledger with
rows.

- No spend **and** no planned amount → the existing `costs.categories.empty` copy.
- No spend **but** planned amounts → the new `categories.nothingSpent` line, with the planned-only
  categories listed beneath as plain rows (the list they replace showed them, and the old empty
  copy would contradict what is on the card).

A failed load is the route's `errorComponent` (`CostsError`, which already retries through
`router.invalidate()`); a card-level `Alert` with a retry would reload the same data and fail the
same way. There is no `pending` prop and no skeleton inside the card: the component never renders
before the loader has resolved, so the prop would be dead code; the route's `CostsSkeleton` covers
loading and is `04-S2`'s file.

### The per-member bar

`MemberBar` sits in the footer of the inverse "Total trip spend" tile, above the existing
"Your share / You paid" pair, which stays. It divides the trip's spend by **each member's
`shareMinor`** (`snapshot.balances`) — who the money was spent on — not by what each paid, which
the "Outstanding" tile and the Balances panel already say.

**Contract.** `stat-tiles.tsx` builds `members: ReadonlyArray<{ userId, name, shareMinor }>` from
`snapshot.balances`, in `balances` order (that order is the deterministic tie-break), with the name
already resolved: the viewer is `t('costs.person.you')`, a removed traveller is
`t('costs.person.removed')`. `nameOf` in `stat-tiles.tsx:44-46` returns a hardcoded
`'Removed traveller'` today and switches to the catalogue key, so the file gains `useTranslate` and
the new list and `PeopleLine` share one resolver (this one change reaches the other tiles and is the
single exception to "the other three tiles are untouched"). `MemberBar` takes `{ members,
spentMinor }`, runs the pure `memberSegments` of `chart-geometry.ts` itself, and calls
`useTranslate` / `useLocale` for its own copy (the "other travellers" and "Not assigned to
anyone" labels, and the percent text). It has no `currency` prop: it shows names and
percents, no amounts.

- Widths are measured against `spentMinor`, never against the sum of shares. When shares fall short
  (an expense can have no participants, `src/server/fns/costs.ts:197`), the gap is one neutral
  **"Not assigned to anyone"** segment, so the bar never overstates anyone. Should shares ever exceed
  the spend (an optimistic overlay mid-write), the widths are measured against the sum instead.
- Members with `shareMinor === 0` are left out. Past four people the bar shows the top three by
  share and one **"N other travellers"** segment, so the bar has at most five segments: four tinted
  ones and the outline remainder.
- The bar is not drawn when fewer than two segments result: a bar of one colour says nothing. Its
  visible heading and its list go with it: all three are absent together, so there is never a
  "Who it was spent on" heading over a single "You 100%".
- Segment order, for the bar and the list alike: members by share descending, ties in `balances`
  order, then "N other travellers", then "Not assigned to anyone" last. Tints are assigned in that
  order, so the largest share is the brightest.
- Segments are monochrome tints of `--color-inverse-on` at the stepped opacities exported as
  `MEMBER_TINTS = [1, 0.7, 0.52, 0.4]` from `member-bar.tsx` (the contrast test imports it), with a
  2px gap in the tile's ground colour; "Not assigned to anyone" is an **outline** segment in
  `--color-inverse-muted`. The data hues are deliberately **not** used here: they would have to clear
  3:1 on white _and_ on near-black, and would put one colour on a category and a traveller on the
  same screen. Both inverse grounds are checked — `--color-inverse` is `#16150f` in light and
  `#16221d` in dark, declared in **two** dark blocks (`tokens.css:88`, `:309`, `:447`) — and each
  tint, composited over the `--color-inverse` of a block, must be at least 3:1 against that ground
  (WCAG 1.4.11), as must that block's `--color-inverse-muted` outline colour. Every colour is read
  from the same block, so the parse is unambiguous.
- Layout uses flex and logical properties only (no `left`/`right`/`origin-left`), so the bar mirrors
  in `ar`.
- The bar is `aria-hidden`. Beneath it, a real `<ul aria-labelledby>` (labelled by the **visible**
  label `memberBar.label`, a non-heading `<p id>` styled like the tile's "Your share" `dt`: the tile's
  own title is not a heading and the stat grid renders before the panels' `h2`s, so an `h3` would
  skip a level) **mirrors the
  bar's segments in the same order**, at most five rows including "N other travellers" and "Not
  assigned to anyone". Each row is a small `aria-hidden` swatch of its segment's tint (the key to
  the bar), the name and the percent (the same `formatSharePercent`, so a share under 1% reads `<1%`), set in
  `text-inverse-on` / `text-inverse-muted`; names and "N other travellers" **wrap and are never
  truncated** at 360px (the tile's existing `dt`/`dd` use `truncate`; this list does not copy it);
  the percents add up to 100 through `allocatePercents`. No `Avatar` and no `AvatarStack`: each would
  announce the name a second time, and the swatch is the more useful key.

**The inverse tile's own copy moves into the catalogue here**, because this phase rewrites that
tile's footer and a half-localised hero tile reads as broken: "Total trip spend", the two captions,
"Your share", "You paid" (copy below). The other three tiles keep their hardcoded English.

### Alternatives considered, and why they lost

| Alternative                                                 | Lost because                                                                                                                           |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| A charting package                                          | `docs/SPEC.md` §3 freezes the dependency set; `11-S2` already recorded the row as buildable without one.                               |
| Block this stage until `04-S2` files the palette            | `04-S2` has no spec and no issue; a run cannot attach `Blocked by` to an issue that does not exist, so the stage would stall silently. |
| File `--color-data-*` here                                  | A concept owned by `04-S2` (`docs/SPEC.md` §8), and `tokens.css` is in none of this stage's paths.                                     |
| Colour by position in the sorted list (today's `swatchFor`) | Contradicts the ledger chip on the same screen for four of eight categories, and a colour changes when totals reorder.                 |
| Every segment and every row focusable (the plan)            | Up to 16 tab stops; a half-degree path is an unusable pointer target (2.5.8); `aria-controls` onto a hidden ring gives AT nothing.     |
| Keep the old list beside the donut                          | The same category figures drawn twice for no reader benefit; the plan says the list is the partial state the donut completes.          |
| Member bar by what each member _paid_                       | Needs an "unclaimed" segment that repeats the "Outstanding" tile next to it; Balances already shows paid against share.                |

## 📝 Architecture

- **Owner of each new concept** (`docs/SPEC.md` §8): ring geometry and whole-percent allocation —
  `src/components/costs/chart-geometry.ts`; the ring and its legend — `category-donut.tsx`; the
  member segmentation and the bar — `member-bar.tsx` (`memberSegments` lives in
  `chart-geometry.ts` beside `allocatePercents`); category → colour — `-costs/chart-colours.ts`
  (the one function `04-S2` swaps).
- **Seams.** `components/costs` imports nothing from `src/server` and nothing from `src/routes`.
  `rail.tsx` and `stat-tiles.tsx` are the only callers: they translate labels (`categoryLabel`,
  member names), sort rows by `EXPENSE_CATEGORY_ORDER`, and hand over finished rows.
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

None. The contracts are the props (`DonutRow` above; `MemberBar`'s `{ members, spentMinor }`) and the
pure functions of `chart-geometry.ts` (`ringGeometry`, `allocatePercents`, `memberSegments`).

## 📝 UI/UX

- **Rail, "By category" panel.** Donut about 10rem across (a fixed size, `mx-auto`, never stretching
  with the column), the legend below it. The rail is 21rem wide from `xl` and full width below, so
  the ring and its legend are stacked at every width and the ring never becomes a decorative void
  at 2560px. Card is `--radius-xl`, `--shadow-card`, hairline `--color-edge-faint` (the `Panel`
  already is); dark re-declares its own shadow. No hex, no one-off radius, no hand-written shadow.
- **Inverse tile.** The bar, its heading and its list in the footer, above "Your share / You paid".
  The stat grid is one column below `sm`, two from `sm` and four from `xl` (`stat-tiles.tsx:57`),
  and tiles in one row stretch to the tallest, so the constraint is the **list height at `sm` and
  `xl`**: at most five rows, checked in the 1024px and 1280px captures. At 360px a tile has no row
  neighbours.
- Every amount and percent carries `tabular-nums`; spacing from `--space-*`.
- Row states: resting, hover, `:focus-visible`, pressed (pinned) and highlighted-from-segment as
  specified above; no disabled state exists.

## 📝 Visual change expected

- Route `/trips/$tripId/costs`, **rail "By category" panel**: the list becomes a ring with a legend.
  States to capture: resting with spend in at least four categories; a single category (full ring);
  a category below 1% (`<1%`); **spend of zero** with planned lines only; no spend and no plan;
  (Phase 2) legend row hovered; legend row pinned.
- Route `/trips/$tripId/costs`, **"Total trip spend" tile**: the member bar and list, and the tile's
  strings now in the reader's language. States: three members with a split; more than four members
  ("other travellers"); shares short of the spend ("Not assigned to anyone"); a single member (no
  bar).
- Light and dark, at 360, 1024, 1280 and 2560 px (desktop and mobile). No other route changes, and
  no other tile changes except the one `nameOf` fallback named above.
- A state is captured only when the demo workspace already shows it; the states the demo data cannot
  produce (below 1%, more than four members, shares short of the spend, planned-only) are proved by
  the jsdom tests, and the PR body says "not captured" for each rather than claiming it.

## 📝 Copy

New keys in `src/lib/i18n/messages/en/costs.ts`, each landing in all 23 locales in the same change
(`i18n-messages` skill, parity test). Money comes from `formatMoney`, percents from `formatPercent`
(`#/lib/format`) — neither is a message. Reused as they are: `costs.categories.empty`,
`costs.person.you`, `costs.person.removed`. The two `percent.*` keys live outside `categories.*`
because the member list uses them too.

| Key                        | `en` text                                                                                                                                                                | Phase |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| `categories.legendLabel`   | `Spend by category`                                                                                                                                                      | 1     |
| `categories.planned`       | `{amount} planned`                                                                                                                                                       | 1     |
| `percent.belowOne`         | `<{percent}` (`{percent}` is `formatPercent(0.01)`, the localised one percent)                                                                                           | 1     |
| `percent.belowOneSpoken`   | `less than {percent}` (visually hidden; read instead of the `<` glyph, which some screen readers skip)                                                                   | 1     |
| `categories.nothingSpent`  | `Nothing spent yet. Here is what you have planned.`                                                                                                                      | 1     |
| `memberBar.label`          | `Who it was spent on`                                                                                                                                                    | 3     |
| `memberBar.others`         | plural, shaped like `balances.count`: `{one: '{others} other traveller', other: '{others} other travellers'}`, `count` selecting the branch and `{others}` pre-formatted | 3     |
| `memberBar.notSplit`       | `Not assigned to anyone`                                                                                                                                                 | 3     |
| `totalTile.label`          | `Total trip spend`                                                                                                                                                       | 3     |
| `totalTile.captionPlanned` | `Planned {amount} across all travellers`                                                                                                                                 | 3     |
| `totalTile.captionBudget`  | `{amount} budgeted for the trip`                                                                                                                                         | 3     |
| `totalTile.yourShare`      | `Your share`                                                                                                                                                             | 3     |
| `totalTile.youPaid`        | `You paid`                                                                                                                                                               | 3     |

The plural key needs every CLDR branch each locale requires (`pl`, `ru`, `uk`, `ar`, `cs`). A legend
row's accessible name is its visible text with hidden separators, so no `aria-label` template (the
plan's "Food, 32 percent, 412 euros") is added.

## 📝 Edge Cases & Failure Scenarios

| Case                                                  | Behaviour                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| One category has all the spend                        | Full ring (two 180° arcs), `100%` in the legend.                                                  |
| A category worth less than 0.5°                       | 0.5° floor; the others shrink so the ring closes; the legend says `<1%` (spoken: "less than 1%"). |
| A category with a planned amount and no spend         | A planned-only `li`: name and `{amount} planned`, no percent, no zero amount.                     |
| A category with neither spend nor a planned amount    | Left out of the legend.                                                                           |
| A member with a share under 1%                        | `<1%` in the list, the same rule as the legend.                                                   |
| Every expense costs 0                                 | Empty card (`spent === 0`), no buttons.                                                           |
| Planned budget lines, no spend                        | `categories.nothingSpent` plus the planned-only rows.                                             |
| Loader fails                                          | Route `errorComponent` as today; the card is never rendered.                                      |
| Touch device                                          | No hover; pressing a row pins its highlight; no stuck state (mouse-only hover, `:focus-visible`). |
| Press, then press again (row still focused)           | Pin cleared and no segment dimmed: focus from a click or tap is not `:focus-visible`.             |
| A pinned category loses its spend (a write in flight) | The pin is cleared in the same render.                                                            |
| `prefers-reduced-motion: reduce`                      | The transition collapses; the dim to 0.35 still applies, instantly.                               |
| Locale `ar`                                           | Member bar mirrors (flex, logical properties); the ring keeps its clockwise-from-12 order.        |
| Shares sum to less than the spend / more than it      | "Not assigned to anyone" segment / widths measured against the sum.                               |
| A member with `shareMinor === 0`; one member only     | Left out; with fewer than two segments there is no bar, no heading and no list.                   |
| Two categories share a hue (until `04-S2`)            | They touch only when the category between them has no spend; text and the link disambiguate.      |
| Optimistic write in flight                            | Rows come from `snapshot.byCategory` / `snapshot.balances`, so the chart follows the overlay.     |

## 📝 Observability

None: no server path, no log line, no metric. The console must stay silent on the route.

## ✅ Acceptance criteria

Phase in brackets.

1. [1] The rail "By category" panel renders a ring whose segment sweeps total exactly 360°, in
   `EXPENSE_CATEGORY_ORDER`, with a legend in the same order; the old bar list is gone; the panel keeps its label, its
   total-spend count and the budget `Progress` footer unchanged.
2. [1] A category keeps its colour when the totals change, and the ring, legend dot and ledger chip
   agree on it for all eight categories.
3. [1, 3] The allocated percents are whole numbers that sum to 100 by largest remainder (eight
   near-equal shares each stay within one point of their real share); a real share with
   `0 < share < 0.01` renders `<1%` with a hidden spoken form, in the donut legend and in the member
   list alike, and a zero share never does.
4. [1] The ring is `aria-hidden`; the legend is a labelled `ul` of `li`; a spending row's accessible
   text is `name, percent, amount[, planned]` with separators, asserted exactly (the spoken
   form for a share under 1%); a planned-only row reads `name, amount planned`; a category with
   neither spend nor plan is not listed. [2] A spending row
   is a `button` with `aria-pressed`, and the number of focus stops equals the number of categories
   with spend.
5. [2] Hover (mouse), `:focus-visible` or press on a row highlights its segment; hover on a segment
   highlights its row; press pins and a second press clears it with nothing left dimmed while the row
   is still focused; touch leaves no stuck highlight; a pinned row looks different from a hovered one.
6. [1] `empty` renders as specified (`empty` copy or `nothingSpent` with planned rows), with no button
   and no retry control; there is no `pending` prop.
7. [3] The member bar divides `spentMinor` by share, shows "Not assigned to anyone" when shares fall
   short, groups members past four into "N other travellers", orders its segments by share then
   "others" then "Not assigned to anyone", and is absent — with its heading and its list — when
   fewer than two segments result.
8. [3] Every tint and the outline are at least 3:1 against both inverse grounds in all three token
   blocks; the bar is `aria-hidden` and the list beneath mirrors its segments, each with a name and
   a percent, the percents adding to 100.
9. [1, 3] Every new string exists in all 23 locales; `pnpm test` (parity) is green.
10. [3] The inverse tile's label, both captions, "Your share" and "You paid" render from
    `totalTile.*`, and `nameOf` in `stat-tiles.tsx` falls back to `costs.person.removed`.
11. [all] Nothing outside the owned paths and the documents the Phase 1 grep names changed;
    `package.json` and `pnpm-lock.yaml` are untouched.
12. [all] The `capture.mjs` output for the costs route reports no console errors or warnings; the
    ring and the bar have fixed intrinsic sizes, so nothing moves after paint.

## 📝 Risks & Impact Review

| Risk                                                                                   | Severity | Mitigation                                                                                                   |
| -------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| Two pairs of categories share a hue until `04-S2` files eight tokens                   | Low      | Ring order, text on every row and the highlight link; one function (`categoryColour`) to swap later.         |
| A tint fails 3:1 on one of the inverse grounds                                         | Medium   | A unit test composites each tint over every `--color-inverse` declaration in `tokens.css`; the floor is 40%. |
| The member list makes the inverse tile tall at `sm`/`xl`, stretching its row           | Low      | At most five rows; checked in the 1024px and 1280px captures.                                                |
| Category names stay English in 22 locales, and the legend repeats them                 | Low      | Existing, unowned debt shared with the ledger; follow-up ticket F1 (Resolved assumption 11).                 |
| `:focus-visible` is unsupported or unreliable in the jsdom the tests run in            | Low      | The test stubs `matches` when needed; the behaviour itself is the platform's.                                |
| Seven call sites build `Intl.DateTimeFormat` with `month: 'short'` (workerd vs WebKit) | Low      | **Report only**, none is in this stage's paths; a `mobile-safari` difference of that shape is attributed.    |

### Out of scope

A charting grammar (zoomable axis, stacked area, brushing, an interactive multi-series legend) —
BLOCKED per `11-boundaries-and-blockers.md`: stop and report, never install. A display-currency
conversion (`04-S1`). Trip-defined categories and the palette tokens (`04-S2`).

**Follow-up F1 — one extra ticket the slicing run files, not blocked by anything and not part of
this stage's acceptance.** Existing, unowned debt this stage reports rather than edits: the eight
category labels (`CATEGORY_LABELS`, `categories.tsx:19-38`; no `04-S2` text localises them, and a
file `04-S2` edits in wave 1); the copy of the other three tiles in `stat-tiles.tsx` ("You owe",
"You're owed", "Outstanding", their captions, "To"/"From", `pluralise(…, 'expense')`); the literals
of `screen.tsx` ("No expenses yet", "Add the first expense", …); and the physical
`left-1/2`/`right-1/2` classes in `rail.tsx` `Balances` (`docs/SPEC.md` §9). The Phase 1 and Phase 3
PR bodies link that issue, so a reviewer who raises the literal ("Localisation", `CODE_REVIEW.md`)
is pointed at it instead of rediscovering it.

## 📋 Phasing

| Phase | Slice                                                | Blocked by | Demoable on its own                                                         |
| ----- | ---------------------------------------------------- | ---------- | --------------------------------------------------------------------------- |
| 1     | The donut replaces the "By category" list            | none       | The rail shows a ring and a plain-text legend, stable colours, empty states |
| 2     | The legend link: hover, focus-visible, press and pin | Phase 1    | A row and its segment highlight each other, by mouse, keyboard and touch    |
| 3     | The member bar on the "Total trip spend" tile        | Phase 1    | The tile shows who the spend is split between, in the reader's language     |

Three tickets for `afk-to-tickets`; each is a vertical slice through geometry, component, caller,
copy and tests. Phases 2 and 3 are independent of each other but both need `category-donut.tsx`,
`allocatePercents` and the barrel from Phase 1, so each carries `Blocked by` Phase 1.

## 📋 Implementation Plan

### Phase 1 — The donut replaces the "By category" list

1. `chart-geometry.ts` (`ringGeometry`, `allocatePercents`, `formatSharePercent`), exported through
   the barrel (`src/components/costs/index.ts`), with
   `__tests__/chart-geometry.test.ts` written first: sweeps total exactly 360° with no gap or
   overlap; a single category is a full ring and never a degenerate path; a zero total is `empty`;
   a non-positive or non-finite value is skipped; a sub-0.5° category gets 0.5° and the rest absorb
   it, also with more than one such category; whole percents sum to exactly 100 by largest remainder, including eight near-equal shares and
   ties broken by row order; `formatSharePercent` for `0 < share < 0.01`, a zero share, and a
   whole percent through `formatPercent(n / 100)`; row order is preserved and unchanged when a total changes.
2. `-costs/chart-colours.ts` (`categoryColour`) and `-costs/__tests__/chart-colours.test.tsx` as
   specified.
3. `category-donut.tsx` (ring, plain-text legend, `empty`/`nothingSpent` states), exported through
   the barrel, and
   `__tests__/category-donut.test.tsx` (vitest project `ui`, jsdom): the ring is `aria-hidden`; the
   legend is a labelled `ul` of `li`; the exact accessible text of a spending row; planned-only rows
   are plain with the exact text `name, amount planned`; a category with neither spend nor plan is
   not listed; `<1%` is rendered from the real share with its spoken form; each empty state renders as specified with no
   button; segment order follows the rows given.
4. `rail.tsx`: `ByCategory` keeps `Panel`, count and the budget footer, its body becomes
   `CategoryDonut` fed rows sorted by `EXPENSE_CATEGORY_ORDER`; add the Phase 1 keys to all 23
   locales.
5. Docs grep (the rule in `AGENTS.md`, recorded in the PR template): `ByCategory`, `swatchFor`,
   `By category`, `MNY-04`, `donut`, `CATEGORY_SWATCHES` across `docs/`, `.ai/`, `src/`,
   `CONTEXT.md`; update what states what this phase changes.

### Phase 2 — The legend link

1. In `category-donut.tsx`: a spending row becomes `<button type="button" aria-pressed
data-part="donut-legend-row">` inside its `<li>`; `pinned`, `hovered` and `focused` keys with
   transient over pinned; mouse-only pointer handlers on rows and segments; focus highlights only
   under `:focus-visible`; a pin on a category with no spend is cleared; the 0.35 opacity dim and
   the `--duration-fast` transition; the pinned-row and segment-hover row looks as specified.
2. Tests (jsdom): the focus-stop count equals the rows with spend; pressing a row sets
   `aria-pressed` and dims every other segment; a second press clears it **while the row is still
   focused** and nothing stays dimmed; pressing another row moves the pin; a `pointerType: 'touch'`
   event highlights nothing; `:focus-visible` focus highlights and blur clears; hovering a segment
   with a mouse highlights its row; a pin on a category that loses its spend is cleared; the empty
   state has no button.

### Phase 3 — The member bar

1. `chart-geometry.ts`: `memberSegments(members, spentMinor)` — drop zero shares, top three plus
   "others" past four members, a remainder segment, widths against `spentMinor` (or the sum when
   shares exceed it), `balances`-order tie-break, whole percents through `allocatePercents`; tests
   for each case in Edge Cases.
2. `member-bar.tsx` (exporting `MEMBER_TINTS`, and exported with it through the barrel) and
   `stat-tiles.tsx`: the bar, its visible label (a non-heading `<p id>`), the mirrored `ul`, the tints, the outline remainder, logical properties only, hidden below two
   segments; `nameOf` switches to the catalogue keys and the tile's own strings move into
   `totalTile.*`. `member-bar.test.tsx`: the bar is `aria-hidden`; the list mirrors the segments
   in order, each with a name and a percent, adding to 100; "N other travellers" plural; the viewer
   "You" and the removed-traveller label arrive already resolved; a share under 1% reads `<1%`;
   with fewer than two segments there is no bar, no label and no list; and a contrast test that
   composites `--color-inverse-on` at each of `MEMBER_TINTS` over the `--color-inverse` of **every**
   block in `tokens.css` (light and both dark blocks) and asserts at least 3:1 against that ground,
   measuring `--color-inverse-muted` the same way, each colour read from the same block.
3. Add the Phase 3 keys to all 23 locales, the plural with every branch each locale needs.

## Verification

The gate is `validation.commands` in `.ai/agentic.config.json` (`pnpm typecheck`, `pnpm lint`,
`pnpm test`, `bash .ai/scripts/check-generated.sh`, `pnpm build`), run on the last commit of every
ticket's PR. No screenshot is compared anywhere (ADR 0016) and no new `e2e/` declaration is added:
nothing here fails in a browser that a jsdom test cannot reproduce, and the existing
`trips-core.spec.ts` already opens the costs tab under `watchConsole`.

The visual judgement is the **blind A/B pair** (`docs/SPEC.md` §7 item 4, `verifying-changes` skill),
captured with `scripts/visual/capture.mjs` against a demo trip with spend in at least four
categories and at least three members, `--auth`, viewports `360x800,1024x768,1280x900,2560x1440`,
themes `light,dark`: the resting frame, then (Phase 2) `--hover '[data-part="donut-legend-row"]'` and
`--click '[data-part="donut-legend-row"]'` for the pinned state, where the demo workspace shows the
state (see "Visual change expected"). The script presses no keys, so the
keyboard path is proved by the jsdom tests. The capture's `console` and `warnings` output goes into
the PR body; frames stay out of the repository. At 2560px the ring must not be stretched.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                                                    | Applied default                                                                                                                                                                                                                                                                                  | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | How does the spec relate to the unmet dependency on `04-S2` (palette, category rows)?                       | Palette-agnostic components fed an opaque `colour`; `categoryColour` in `-costs/chart-colours.ts` derives it from today's tint hues; no ticket is `Blocked by` `04-S2`; two pairs share a hue until it lands.                                                                                    | Decided by the software architect sub-agent (confidence high): `04-S2` has no spec or issue to block on, `tokens.css` is not owned here (`docs/SPEC.md` §8), and only the colour function changes later. The panel's product owner moved the source from sort position to the ledger chip's hue.                                                                                                                                                       |
| 2   | What does the member bar divide, and what happens to the old "By category" list?                            | Each member's `shareMinor` against `spentMinor` plus a "Not assigned to anyone" remainder; the donut card replaces the list and keeps the budget footer and planned figures in the legend.                                                                                                       | Decided by the product owner sub-agent (confidence medium, high for the list): the plan's data source is the split, "paid" repeats "Outstanding", and the budget progress exists nowhere else; widths against the sum would overstate anyone when an expense has no participants.                                                                                                                                                                      |
| 3   | Empty and error states of a presentation-only card?                                                         | Text-only empty card on `spent === 0`, no action; no card-level error, no retry, no `pending`; **no "invalid" state** (non-positive values are skipped). Planned-only gets its own `nothingSpent` line.                                                                                          | Decided by the traveller sub-agent (confidence high): no `onAddExpense` (`screen.tsx` is not owned, two add buttons exist), a retry reloads the same data, a zero-amount expense can be saved. Panel amendments: the product owner showed an `invalid` state cannot occur; the traveller found the old empty copy contradicts a planned-only card.                                                                                                     |
| 4   | Focus model and legibility on the inverse tile?                                                             | Legend rows are the only focus stops (`button` + `aria-pressed`, press pins, only `:focus-visible` highlights); ring `aria-hidden`; no segment focus, `aria-controls`, hidden table or `Tooltip`; tints of `inverse-on` at 3:1 on every ground; list mirrors the bar; no `Avatar`/`AvatarStack`. | Decided by the accessibility specialist sub-agent (confidence high): fewer tab stops, no 0.5° pointer target, touch parity through the press, the palette cannot clear 3:1 on both white and near-black. Panel refinements (focus-visible only, pinned look, list contents) applied.                                                                                                                                                                   |
| 5   | What replaces the plan's screenshot-baseline verification?                                                  | Vitest geometry, colour and component tests, the blind A/B pair through `capture.mjs`, no `e2e/` change.                                                                                                                                                                                         | ADR 0016 removed `toHaveScreenshot` and `e2e/__screenshots__`; `e2e/budget-and-currencies.visual.spec.ts` does not exist. One defensible answer in the repository, so no specialist was needed.                                                                                                                                                                                                                                                        |
| 6   | Ring and legend order?                                                                                      | `EXPENSE_CATEGORY_ORDER`, clockwise from 12 o'clock; not spend order; the caller sorts, the component preserves.                                                                                                                                                                                 | A segment never jumps when a total changes (the plan's own stability test) and same-hue pairs are mostly separated; the legend carries percents so ranking by spend is not lost. The panel corrected the earlier claim that the pairs "always sit apart".                                                                                                                                                                                              |
| 7   | Sub-1% shares?                                                                                              | Rendered `<1%` from the real share (`percent.belowOne` and a spoken `percent.belowOneSpoken`, shared with the member list), geometry floor 0.5°; the sum-to-100 property belongs to the allocated integers.                                                                                      | Default applied: `0%` beside a visible segment reads as a bug; the placeholder keeps the percent sign positioned by the locale. Panel (architect) made the rendering rule precise.                                                                                                                                                                                                                                                                     |
| 8   | Entrance sweep, stroke-width hover and `pending` skeleton from the plan?                                    | Dropped: the only motion is the `--duration-fast` opacity transition of the link highlight.                                                                                                                                                                                                      | Default applied: a sweep needs keyframes in `styles.css` (not owned) or a post-hydration state flip that blanks the server-rendered ring; the plan's "transform and opacity only" rule contradicts its own stroke-width hover; the card never renders before the loader resolves.                                                                                                                                                                      |
| 9   | Move the existing hardcoded English of `stat-tiles.tsx` / `screen.tsx` into the catalogue?                  | Only the inverse tile this stage redesigns (5 keys) and the `nameOf` fallback; the other three tiles and `screen.tsx` stay as follow-ups.                                                                                                                                                        | Panel (traveller, accessibility, product owner): Phase 3 rewrites that tile's footer, and a half-localised hero tile reads as broken; moving the rest is a separate concept with its own owner.                                                                                                                                                                                                                                                        |
| 10  | The workerd/WebKit `Intl.DateTimeFormat` `month: 'short'` precondition inherited by every stage of plan 04? | Disposition **report**: none of those call sites is in this stage's paths.                                                                                                                                                                                                                       | Plan text, `12-verification-protocol.md` §7.2 and `docs/SPEC.md` §7 item 6; nothing lets a stage edit a file it does not own.                                                                                                                                                                                                                                                                                                                          |
| 11  | Localise the category names (`categoryLabel`, hardcoded English) in this stage?                             | No: named as `04-S2`'s debt, shared with the ledger and the expense dialog; the legend uses whatever `categoryLabel` returns.                                                                                                                                                                    | Panel disagreed (traveller: add `categories.tsx` and 8 keys; product owner and accessibility: name it as follow-up). The more reversible option applies: no `04-S2` text localises the labels, but `categories.tsx` is a file `04-S2` edits in wave 1, so an edit here would collide with it, and the old list already showed English names — no regression. It is existing unowned debt, so the slicing run files follow-up F1 for it (Out of scope). |
| 12  | Where do the slices depend on each other?                                                                   | Phase 1 first; Phases 2 and 3 each `Blocked by` Phase 1 and independent of each other; legend rows are plain `li` in Phase 1.                                                                                                                                                                    | Panel (product owner, architect): shipping inert `aria-pressed` buttons on `develop` is a defect, and the later phases need Phase 1's component, `allocatePercents` and the barrel.                                                                                                                                                                                                                                                                    |
| 13  | Panel verdict, product owner (final round 2)?                                                               | approve with conditions; conditions applied.                                                                                                                                                                                                                                                     | Decided by the product owner sub-agent (confidence high): it is the stage and one complete slice per phase; conditions applied: planned-only rows, a single follow-up ticket F1 instead of vague candidates, tile and label wording.                                                                                                                                                                                                                   |
| 14  | Panel verdict, software architect (final round 2)?                                                          | approve with conditions; conditions applied.                                                                                                                                                                                                                                                     | Decided by the software architect sub-agent (confidence high): seams and owners named; conditions applied: largest-remainder allocation, `formatSharePercent` as the one owner of the rendered percent, neutral `percent.*` keys, barrel exports in each phase.                                                                                                                                                                                        |
| 15  | Panel verdict, accessibility specialist (final round 2)?                                                    | approve with conditions; conditions applied.                                                                                                                                                                                                                                                     | Decided by the accessibility specialist sub-agent (confidence high): conditions applied: `ring-inset` pinned look instead of an outline, reduced-motion keeps the dim, spoken form for `<1%`, wrapping names, non-heading list label, per-block contrast test.                                                                                                                                                                                         |
| 16  | Panel verdict, traveller (final round 2)?                                                                   | approve with conditions; conditions applied.                                                                                                                                                                                                                                                     | Decided by the traveller sub-agent (confidence high): conditions applied: legend content and order rules, no heading or list without a bar, localisation acceptance criterion for the tile, honest capture caveats.                                                                                                                                                                                                                                    |
| 17  | Is a security and tenancy or configuration review needed?                                                   | No.                                                                                                                                                                                                                                                                                              | The spec touches no authentication, tenant scoping, role, sharing, stored file, `.claude/`, workflow or CI; the stage is presentation over data the loader already returns.                                                                                                                                                                                                                                                                            |
