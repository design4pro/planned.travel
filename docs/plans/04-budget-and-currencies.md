# Budget and currencies

The money area: what a trip plans to spend, what it actually spent, whose money it was, and which
currency any of that was denominated in. Seven rows of the 89-row matrix sit here — `MNY-01` through
`MNY-07` — and this file carries all seven.

## What is on disk today

Measured at HEAD, not assumed. Every claim below names the file it was read from, because a plan that
asserts how existing code behaves is the part of a plan most often wrong.

| Layer      | What exists                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema     | `budget_items`, `expenses`, `expense_shares`, `settlements` (`src/server/db/schema.ts:748-871`). Money is `integer` minor units paired with a `text(3)` ISO-4217 code everywhere — the helpers are `minor()` at line 88 and `currency()` at line 85.                                                                                                                                                                                                                                                                                                                                                                  |
| Repository | `src/server/repos/expenses.ts`, 645 lines: `computeShares`, the four writers, `getTripSpendSummary`, `getMemberBalances`, `suggestSettlements`, `listDailySpend`. Every query is built through `tenantFilter()` or a `createTenantRepository` handle.                                                                                                                                                                                                                                                                                                                                                                 |
| Server     | `src/server/fns/costs.ts`, 482 lines: `loadCosts` plus `createExpenseFn`, `updateExpenseFn`, `deleteExpenseFn`, `recordPaymentFn`. The three expense writers already mirror to the trip room under the `expense` entity kind (`costs.ts:419,438,456`).                                                                                                                                                                                                                                                                                                                                                                |
| Route      | `/trips/$tripId/costs` — `src/routes/_app/trips/$tripId/costs.tsx`, with a URL-backed filter contract, `CostsSkeleton` as `pendingComponent` and `ErrorPanel` as `errorComponent`.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Screen     | `-costs/screen.tsx` (387), `expense-list.tsx` (209), `rail.tsx` (395), `stat-tiles.tsx` (176), `categories.tsx` (95), `skeleton.tsx` (69), `actions.ts` (248).                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Components | `src/components/costs/`: `expense-dialog.tsx` (486), `split-editor.tsx` (482), `payment-dialog.tsx` (291), `costs-toolbar.tsx` (228), `confirm-delete.tsx` (121), `data.ts` (557).                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Formatting | `src/lib/money.ts` already owns `minorUnitDigits`, `formatMoney`, `formatMoneyPlain`, `formatSignedMoney`, `formatConversion`, `formatExchangeRate`, `impliedRate`, `splitShares`, `splitPreview`, `suggestTransfers`, and a curated 32-entry `CURRENCY_OPTIONS`. No stage re-implements any of them.                                                                                                                                                                                                                                                                                                                 |
| Currency   | **The per-expense source currency is shipped end to end.** The dialog picks the receipt's currency from `CURRENCY_OPTIONS` (`expense-dialog.tsx:318-329`), reveals a second field for the converted figure (`:332-356`), the server drops a source currency equal to the trip's own and derives `exchange_rate` from the amount pair rather than trusting a client rate (`src/server/fns/costs.ts:258-301`), and the three columns are written by `createExpense`/`updateExpense` (`src/server/repos/expenses.ts:98-100`). The CSV export already carries all three (`data.ts:493-497`). No stage rebuilds any of it. |

So this area is **not** a greenfield. Six of the seven rows are `partial` and one is `done`; every
stage below extends a working screen rather than building one, and a stage that would write a second
`formatMoney`, a second greedy matcher or a second split preview is a defect rather than a plan.

## The seven rows and the stages that close them

| Row      | Wave | Stage   | From → to                                                                          |
| -------- | ---- | ------- | ---------------------------------------------------------------------------------- |
| `MNY-07` | 1    | `04-S1` | partial → done, with one behaviour deferred to `04-S7` and its reason stated       |
| `MNY-05` | 1    | `04-S1` | done → done — one column added because this stage mints the display currency       |
| `MNY-01` | 1    | `04-S2` | partial → done, with one behaviour deferred to `04-S3` and its reason stated       |
| `MNY-02` | 2    | `04-S3` | partial → done                                                                     |
| `MNY-04` | 2    | `04-S4` | partial → done                                                                     |
| `MNY-06` | 2    | `04-S5` | partial → done                                                                     |
| `MNY-03` | 3    | `04-S6` | partial → done                                                                     |
| —        | 6    | `04-S7` | closes no row; it lands the one behaviour `04-S1` defers, once a decision is taken |

Waves are read straight off the table in `README.md` and no row is moved. `04-S7` closes no row, so
no wave in that table implies one for it; it states **wave 6** — the last wave `README.md` defines,
and the earliest wave it could ever occupy, since everything it would enable sits in waves 1 to 3.
That is a floor and not a release date: the stage is **additionally** gated on the provider decision
recorded in `11-boundaries-and-blockers.md` (`11-S3`), and wave 6 opening does not by itself make it
schedulable. The wave is stated rather than left blank because a stage with no parseable wave is
invisible to `scripts/ultrabuild/check-plan-collisions.mjs`, which buckets every wave-less stage
together and can only report that it could not check them — and `04-S7` claims
`src/server/repos/rates.ts` exclusively, which is exactly the kind of claim that has to be
checkable. `04-S7` is written now so that the deferral in `04-S1` points at a stage id rather than at
an intention.

## Obligations received from the grilling of `01-trips-core.md`

Two decisions taken while grilling the trips plan (2026-08-28) land in this area's tables, and each is
carried by the stage named here rather than by `01-*`, so that no file sits in two plans.

- **The trip copy reproduces budget lines (decision 4b).** `01-S1` ships a copier registry —
  `registerTripCopier(name, fn)` in `src/server/repos/trips.ts`, `fn` receiving the source and target
  trip ids and the day and place id maps — and copies only its own aggregate. **`04-S3`** (wave 2, the
  first stage here that opens `budget_items` after the registry exists in wave 1) registers the copier
  for `budget_items` and `trip_cost_categories`: every line and every category of the source, amounts
  and currency as stored, `sort_order` preserved, the category ids remapped, chunked at the same
  `floor(100 / columns)` bound `01-S1` states, and a report of rows written so the copy's completion
  notice can name them. Expenses, shares and settlements are the record and are never copied; a copier
  that touched them would be the defect.
- **A guest can be split onto, and a guest can be merged into a member (decision 7b).** `01-S6`
  ships guests and `mergeTripGuest`, which runs every registered relinker —
  `registerGuestRelinker(name, fn)`, `fn` rewriting one table's guest references to the member's user
  id — and fixes the shape a guest reference takes: **a `user_id` xor a `guest_id`, never one
  polymorphic id.** `04-S6`'s `participants` column is JSON, so the shape there is a discriminated
  entry — `{ kind: 'member', userId }` or `{ kind: 'guest', guestId }` — validated against
  `listTripParticipants`, and **`04-S6`** registers the relinker that rewrites a guest entry to the
  member entry inside every affected expense and share in one batch. A guest in a split is settled like
  a member; who pays the guest's share in cash is outside the ledger, as it is in the reference.

## Money conventions that bind every stage in this file

Stated once here and not re-argued per stage, though each stage restates the part it uses:

- **Every monetary field is an `integer` in the minor unit of its currency, paired with a separate
  `text(3)` ISO-4217 column.** No stage stores a decimal amount, a formatted string or a currency
  baked into the amount's name. `JPY` has zero minor digits and `KWD` has three, so "cents" is never
  assumed — `minorUnitDigits()` (`src/lib/money.ts:122`) resolves it through `Intl`.
- **A rate is a `real`, and it is major-per-major**: `1 <from> = rate <to>`. Converting minor to minor
  therefore needs the digit difference:
  `to_minor = round_half_up(from_minor × rate × 10 ^ (digits(to) − digits(from)))`. Rounding happens
  exactly once, at that boundary. This is the arithmetic that silently produces hundred-fold errors
  when a zero-decimal currency meets a two-decimal one, and it is tested rather than trusted.
- **Every number that can change is rendered with `font-variant-numeric: tabular-nums`**, per
  `DESIGN.md`. Every amount, every rate, every percentage, every count on every surface any
  stage in this file ships. There is no exception, and "the figure is inside a `StatCard` already"
  is not one — the stage checks the rendered element, not the ancestor.
- **A row's two denominations never mix, and a column name says which one it is in.** A money row in
  this area can carry an **accounting** figure — `amount_minor` with `currency`, always the trip's own
  currency, which is what every share, balance, aggregate and settlement is denominated in — and a
  **receipt** figure, `original_amount_minor` with `original_currency`, which is what the reader read
  off the paper. Anything derived from a row (a share, a per-line amount, a total) states which of the
  two it is in, and a child row that has no currency column of its own is named for the denomination
  it inherits. This is not pedantry: writing a receipt-currency figure into an accounting-currency
  column is silent, passes every same-currency test, and puts every balance on the trip out by the
  exchange rate. `04-S6` carries the worked example, because that is the stage where an earlier draft
  did precisely that.
- **Netting order is fixed**: balances are netted in the trip's own accounting currency first and
  converted for the reader exactly once, at the end. Converting per expense and then summing lets
  rounding drift re-open a cleared trip into phantom one-unit debts, which is a defect that arrives
  weeks after the code that caused it.
- **SQL lives only in `src/server/repos/`**, every query starts from `tenantFilter()` and every table
  in this area carries `organization_id` as the leading column of its indexes. A well-formed trip id
  from the browser is not an authorised one: it is re-resolved through `requireTrip()` inside the
  caller's scope, and a foreign id is a `NotFoundError`.

## Two disagreements with the matrix, both with evidence

A plan that contradicts a `gap-rows.json` row says so and shows its measurement.

**1. The recorded schema defect for `MNY-07` is already repaired.** The row's evidence, and
`scripts/seed/README.md:252-266`, both say `expenses.originalCurrency` and `expenses.currency` map to
one SQL column and discard the receipt's own currency on write. Measured at HEAD they do not:
`src/server/db/schema.ts:794` reads `originalCurrency: currency('original_currency')`, and
`drizzle/0001_aspiring_cargill.sql:14` creates `original_currency text(3)` on the rebuilt table. The
`expenses` row therefore already holds `original_amount_minor`, `original_currency` and
`exchange_rate`, **and a write path fills all three today**: `expenseBodySchema` accepts the source
pair (`src/server/fns/costs.ts:175-180`), `toRepoInput` drops a source currency equal to the trip's
own and derives the rate from the amount pair (`:283-301`), the repository input validates the triple
(`src/server/repos/expenses.ts:98-100`), and the dialog is the picker that produces it
(`src/components/costs/expense-dialog.tsx:318-356`). No stage in this file re-opens that path.

**The precondition survives, because the same three columns are missing from `settlements`**, which
carries only `currency` (`schema.ts:844-871`). A payment made in a currency other than the trip's is
exactly the case `MNY-03` has to record, and it cannot be recorded at all until those columns exist.
`00-foundations.md` reaches the same conclusion from the same measurement and mints it as stage
`00-S1`; `04-S1` below states the requirement in the identical shape and does not restate the
migration itself, because the schema module is shared and wave 0 owns it. `04-S1` files **one**
further column into that same migration — `user_settings.display_currency`, under the absorption
clause `00-S1` writes for exactly this case — and says there why the reader's display preference
cannot live on the column that already carries the currency a new trip starts in.

**2. `MNY-07`'s live-rate half cannot be built by any stage in this file.** The row asks for a
per-user display currency "at live rates". A live rate needs an outbound provider, no provider is
chosen, and `11-boundaries-and-blockers.md` (`11-S3`) records that choosing one here would be the
worst outcome available. `04-S1` therefore ships every part of the row that is not already on disk
and does not need an outbound call, names the deferred behaviour, and points it at `04-S7`.

## Clean-room

The upstream project is "the reference product" and its wiki pages are cited as `` `wiki: <Page>` ``
with no URL and no name. Nothing in this file reproduces a sentence, a table name, a column name, an
enum value or a UI string from it. Behaviours are described in planned.travel's vocabulary against
the tables that already exist in `src/server/db/schema.ts`.

## One shared file inside this plan, and the rule it follows

`12-verification-protocol.md` §4 fixes one visual spec file per plan file —
`e2e/budget-and-currencies.visual.spec.ts` — and says stages within a plan share it, told apart by a
`test.describe` block named for the stage. `README.md` also says two stages in one wave may not name
the same file, and `04-S1` and `04-S2` are both wave 1.

This plan resolves that the only way that keeps both rules true: **the spec file and its baseline
directory are `new` in `04-S1` and `append` in every later stage, under the same mechanical rule
`00-foundations.md` gives the isolation suite** — a stage adds its own `describe` block at the end
and edits nobody else's, so two stages landing together produce a merge resolved by keeping both.
Baseline files are named per frame, and a frame name always begins with the stage id, so two stages
cannot write the same PNG.

**Both paths are listed under Owned paths by every stage, not only by the one that creates them.**
The spec file and `e2e/__screenshots__/budget-and-currencies.visual.spec.ts/` travel together:
`playwright.config.ts:49-50` derives the baseline directory from the spec's file name, so a stage
that runs `--update-snapshots` for its own `describe` block writes PNGs into that directory whether
it named it or not. A stage that writes into a path it did not declare fails `docs/SPEC.md` §7 item 6
however good the pixels are, and an auditor diffs the actual changes against the list. So each of the
seven stages below names both, marked `new` in `04-S1` and `append` in `04-S2` through `04-S7`.

The same treatment is asked of `src/server/repos/__tests__/tenant-isolation.test.ts`, where
`00-foundations.md` already grants it.

## How Owned paths are written here, and why the form matters

Every stage's **Owned paths** is a bullet list of `` `path` — mode ``, never a table. That is not a
style preference: `scripts/ultrabuild/check-plan-collisions.mjs` parses exactly that shape, and a
plan that writes its ownership as a table contributes **zero** paths to the collision check while
still reading as though it had been checked. This file was in that state and its clean result meant
nothing; the last section of this file records what the check said once the form was fixed, and what
had to change to make it say it.

## The harness every stage in this file runs

`docs/SPEC.md` §7 item 4 asks for a feature "visually verified in a real browser, light and dark,
desktop and mobile" and names no tool. `12-verification-protocol.md` §2 makes that runnable and §8
fixes what a finished stage leaves behind. This section writes the two invocations out once, in the
form every stage below repeats with its own route, stage id and declared states — because an
invocation nobody quoted is an invocation nobody ran, and a plan that asserts visual verification
without one has asserted something unfalsifiable.

**The port is resolved, never assumed.** `playwright.config.ts:9-10` reads `PLAYWRIGHT_BASE_URL` and
falls back to `http://localhost:3000`, starting its own `webServer` when the variable is unset. Port
3000 is not guaranteed to be this application on a developer machine, and a suite pointed at a
stranger's server reports failures that look like product defects.

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)      # --start only if the pool is empty
```

**The gate.** `package.json` declares no `test:e2e`, no `test:visual` and no `playwright` script, and
`docs/SPEC.md` §3 freezes `package.json`, so no stage may add one and every stage writes the
invocation out in full:

```sh
# once, and again whenever an authenticated route starts redirecting to /login
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup

# this plan's spec, both browser projects — chromium at 1440x900 and mobile-safari at 393x659
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/budget-and-currencies.visual.spec.ts

# record only the running stage's own baselines, selected by its describe-block name
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/budget-and-currencies.visual.spec.ts --update-snapshots -g '04-S1'
```

`--update-snapshots` writes into `e2e/__screenshots__/budget-and-currencies.visual.spec.ts/`, which
`playwright.config.ts:49-50` derives from the spec's file name. That is why every stage in this file
lists that directory under **Owned paths**. `maxDiffPixelRatio` stays at `0.002` and `threshold` at
`0.2`: `12-verification-protocol.md` §5 forbids raising either, globally, per project or per call,
and no stage here does.

**The frames a blind critic looks at.** `scripts/ultrabuild/capture.mjs` takes those and deliberately
writes nothing under `e2e/__screenshots__`. The clock pin is not a default — the header interceptor
is installed only `if (serverToday)` (`scripts/ultrabuild/capture.mjs:168-169`) — and `2026-08-20` is
not a free choice: it is `BASELINE_DAY` in `e2e/helpers/shoot.ts` and the same string
`playwright.config.ts` sends, so a stage that omits it photographs one day next to baselines recorded
on another.

```sh
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/$TRIP_ID/costs" \
  --out ".claude/ultrabuild/shots/04-budget-and-currencies/round-<n>/04-S1" \
  --label B --auth \
  --viewports 360x800,1280x900,2560x1440 --themes light,dark
```

Six frames per surface — light and dark at 360, 1280 and 2560 — per `12-verification-protocol.md` §3,
and no stage negotiates that set down. `$TRIP_ID` is the seeded demo trip's id, read from `/trips`
rather than hard-coded into a plan that would rot on the next re-seed. `--auth` refuses to file a
frame that landed on `/login`, which is what a stale `e2e/.auth/demo.json` produces, and the fix is
the `--project=setup` line above. The pin reaches only `vite dev`: `serverToday()` reads the header
inside an `if (import.meta.env.DEV)` branch (`src/server/clock.ts:73-90`) that the production build
folds out, so every capture in this file is pointed at the dev server the port script resolves and
never at `pnpm preview` or a deployed Worker. Frames go to
`.claude/ultrabuild/shots/04-budget-and-currencies/round-<n>/<stage-id>/` and nowhere else — not the
repository root, not `docs/` — and scratch scripts go to the session scratchpad and are deleted after
use.

Nothing in this file is captured with `--map`. `/trips/$tripId/costs` renders no `[data-map-ready]`
marker, and `settleMap()` fails a route that declares one and renders none.

**One measured limit, which decides how each declared state is reached.** `capture.mjs` applies at
most one `--hover` and then at most one `--click` per invocation, in that order
(`scripts/ultrabuild/capture.mjs:218-224`); it has no `--press`, no keyboard driver and no request
interception. `12-verification-protocol.md` §3 sanctions two routes to a declared state, and this
file uses both by that measurement rather than by preference:

- a state **one hover or one click** from the resting route is taken by `capture.mjs`, and the stage
  quotes that invocation with its selector;
- a state needing **two steps, a keyboard focus ring** — `:focus-visible` does not appear on a mouse
  click, so a clicked frame is not evidence about it — **or a failed request** is reached inside this
  plan's own spec, and its frame is written with `page.screenshot({ path: testInfo.outputPath(name) })`
  into `test-results/` (`playwright.config.ts:51`, already git-ignored) and then copied into the same
  round and stage directory as the resting set. Both browsers write to a temporary path first, so the
  copy is a step that was being taken anyway.

Every selector a stage passes to `--hover` or `--click` is verified to exist against a running server
before capture — `page.locator(sel).count()` returning 1 — because a selector that resolves to
nothing makes `capture.mjs` throw at the flag and costs the round. Reading the JSX and believing it
is not a verification.

**Two harness preconditions this file inherits, recorded rather than rediscovered.** Every stage here
baselines `/trips/$tripId/costs`, which is a trip tab, so `12-verification-protocol.md` §7.2 applies:
seven call sites still build their own `Intl.DateTimeFormat` with `month: 'short'`, two of them in
`src/components/costs/data.ts`, and workerd and WebKit disagree on the abbreviation. Each stage
records it under **Blockers** rather than absorbing it, and no stage in this file widens a diff budget
to hide it. And §7.3: the browser revisions behind these baselines are pinned by nothing in the
repository, so a green comparison here proves this file changed nothing on this machine and is not a
claim that the design renders identically on another.

## Stage 04-S1 — Give a payment its own currency, and give the reader a currency to read in

### Stage id

`04-S1` · Wave 1 · effort **L**. The first stage in this file, because it is the stage that consumes
the `settlements` currency columns of migration `0002`, and because every later money surface in this
file renders a converted amount through the arithmetic and the display-currency resolver that land
here.

### Reference rows

- `MNY-07` partial → **done**, with one behaviour deferred and stated: converting a reader's view
  into a currency that is not any trip's own currency needs a live rate from a provider that has not
  been chosen. That behaviour is deferred to **`04-S7`**. The per-expense half of the row is
  **already done at HEAD** — source currency, converted amount, and a rate frozen at save time and
  never recomputed — and this stage neither rebuilds nor reverses it. What lands here is the rest of
  the row: settlement payments under the identical rule, the minor-to-minor conversion arithmetic the
  rest of this file needs, a suggested converted figure derived from a rate this workspace has
  already used for that pair, and a per-user display-currency preference on a column of its own, in
  the two states that need no outbound call.
- `MNY-05` done → **done**. The comma-separated export at `src/components/costs/data.ts:477` already
  carries the source amount, the source currency and the rate as their own columns. This stage adds
  one column — the amount in the reader's display currency — because this stage is where a display
  currency starts to exist. Nothing else about the export changes.

This stage unblocks six rows across three areas, and they are named so a reader knows what slips if
it slips: **`MNY-02`** and **`MNY-03`** in this file (both render a source amount beside an
accounting amount, and `MNY-03` records payments under the same rule), **`MNY-06`** in this file
(re-basing has to re-anchor frozen rates), and the cross-area rows **`TRP-05`** (`01-trips-core.md`,
the dashboard converter widget), **`COL-10`** (`07-collaboration-and-sharing.md`, the guest viewer
that resolves sharer currency then trip currency) and **`ACC-04`** (`09-account-and-settings.md`, the
regional settings surface that presents the display preference).

Behaviour sourced from `wiki: Currencies`, restated in our own vocabulary.

### Owned paths

- `src/lib/money.ts` — edit. `convertMinor()` and the display-currency resolver. No existing export
  is changed; `impliedRate` and `formatExchangeRate` in particular are read by this stage and edited
  by nobody in it.
- `src/lib/__tests__/money.test.ts` — edit.
- `src/server/repos/rates.ts` — new. The frozen-rate read, the `resolveRate` seam with its KV cache,
  and the only reader and only writer of the `user_settings.display_currency` column filed below.
  The module answers one question — "what currency does this reader see, and what rate gets them
  there" — and the preference is its first half. **Server** states why that preference is not written
  through the settings repository, and the answer is a measured wave-1 ownership fact rather than a
  taste. No writer of a single expense or settlement ever calls into any of it.
- `src/server/repos/__tests__/rates.test.ts` — new.
- `src/server/repos/expenses.ts` — edit. `createSettlement` only. `createExpense` and `updateExpense`
  are not touched by this stage.
- `src/server/fns/costs.ts` — edit. The `loadCosts` payload and `recordPaymentFn`. The two expense
  write endpoints are not touched by this stage.
- `src/components/costs/expense-dialog.tsx` — edit. One pre-filled suggestion and its hint; the
  currency control itself is not rebuilt.
- `src/components/costs/payment-dialog.tsx` — edit. The foreign-currency field set it does not have.
- `src/components/costs/costs-toolbar.tsx` — edit. The display-currency indicator and its menu.
- `src/components/costs/data.ts` — edit.
- `src/components/costs/__tests__/data.test.ts` — edit.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. One new `describe` block that
  edits none of the existing ones.
- `e2e/budget-and-currencies.visual.spec.ts` — new. This plan's spec file, per
  `12-verification-protocol.md` §4.
- `e2e/__screenshots__/budget-and-currencies.visual.spec.ts/` — new. Its baseline directory.

**Two of those files are owned by another plan in an earlier wave, and each is named here with its
sibling stage id** so the cross-plan check in this file's last section resolves rather than merely
passes. `src/server/repos/expenses.ts` is held by **`00-S1`** (`00-foundations.md`, wave 0), which
adds the settlement writer's source-field guard; this stage is that guard's first caller and edits
the same module a wave later. `src/server/fns/costs.ts` is held by **`00-S2`** (`00-foundations.md`,
wave 0), which makes the expense writers notify the members a split lands on. Both close before wave
1 opens, so neither is a same-wave claim, and this stage starts from their landed edits rather than
from HEAD.

**Not owned by this stage, and listed only to be excluded** — none of these is an owned path of any
stage in this file: the schema module and `drizzle/`, the token file, `src/components/ui/**`, the
Worker entry, the Wrangler config, the generated route tree, and the two dependency manifests. The
first two belong to wave 0; the rest are shared or generated and no feature stage names them.

**The two settings modules are excluded for a different reason, and it is a measured one.**
`src/server/repos/settings.ts` and `src/routes/_app/-server/settings.ts` are both held **in wave 1**
by `02-S2` (`02-places-and-maps.md`), which narrows the map-style preference in them;
`node scripts/ultrabuild/check-plan-collisions.mjs` prints `02-S2 wave 1 (edit)` against both paths,
and this stage is wave 1 too. Two exclusive claims in one wave clobber each other, so this stage
takes neither, and the display preference it ships reaches `user_settings` without editing either
module — how, and why that is not a second settings writer, is under **Server**. The settings
screens are excluded on the same evidence: `src/routes/_app/settings/index.tsx` is held by `09-S3`
(wave 1) and `09-S8` (wave 3), and `appearance.tsx` by `02-S2` (wave 1).

`src/routes/_app/trips/$tripId/-costs/**` is not claimed either: `04-S2` holds that directory for
wave 1, and this stage reaches the screen through the components and the loader payload it does own.

### Data and migration

**No schema edit belongs to this stage.** It states one requirement, which `00-foundations.md`
executes as `00-S1` inside migration `0002`, and the shape below is the shape recorded there.

Three columns are added to `settlements`, all nullable, no default, no new CHECK:

| Column                  | Type      | Meaning                                                                       |
| ----------------------- | --------- | ----------------------------------------------------------------------------- |
| `original_amount_minor` | `integer` | The amount actually transferred, in the minor unit of `original_currency`.    |
| `original_currency`     | `text(3)` | ISO-4217, from the same `currency('original_currency')` helper as `expenses`. |
| `exchange_rate`         | `real`    | Major-per-major, frozen at the moment the payment was recorded.               |

**Additive only.** No column is dropped, renamed or narrowed, and the previous Worker keeps working
against the new table because it reads none of the three. No CHECK is added on purpose: drizzle-kit
emits a full table rebuild for a constraint change on SQLite — `drizzle/0001_aspiring_cargill.sql` is
that rebuild — and the non-negative guard on `original_amount_minor` is held instead by the Zod input
in `src/server/repos/expenses.ts`, matching `expenses_original_amount_chk` semantics without the
rebuild. No new index: every read of `settlements` already leads with `organization_id` through
`settlements_org_trip_idx`, and none of the three columns is a filter.

**Backfill for existing rows: none is executed, and the rule for reading an un-backfilled row is
stated rather than left to inference.** Every settlement written before `0002` was, by construction,
denominated in the trip's own accounting currency, so no `UPDATE` can add information that is not
already in `amount_minor` and `currency`. The three new columns stay `NULL` on those rows, and the
read path treats that triple of nulls as exactly one thing: _this payment was made in the accounting
currency, no conversion happened, and the implied rate is 1_. That reading is asserted by a unit
test rather than assumed, so a future stage cannot quietly redefine `NULL` as "unknown".

**One further column, on `user_settings`, filed to the same migration under `00-S1`'s own absorption
clause.** That clause is not an inference — `00-foundations.md` writes it out: "Before this stage
closes, it also absorbs any **Data and migration** requirement filed by a wave-1 stage in plans
01–11, so that wave 1 opens against one migration rather than eleven." The three `settlements`
columns above are the precondition `00-S1` records, in `00-S1`'s own shape and with nothing changed
about it; this fourth column is a wave-1 requirement filed into the same run:

| Column             | Type      | Meaning                                                                                                          |
| ------------------ | --------- | ---------------------------------------------------------------------------------------------------------------- |
| `display_currency` | `text(3)` | The reader's display preference. `NULL` means none. Declared as `currency('display_currency')`, the same helper. |

Nullable, no default, no CHECK — the shape every other override on that table already has (`locale`,
`timezone`, `currency`, `week_starts_on`, `date_format`, `distance_unit`, `map_style`,
`src/server/db/schema.ts:1834-1840`), and for the same reason a default is refused there: it would
make "not chosen" indistinguishable from "chosen to be the default". No index — the row is reached by
user id through `user_settings_org_user_unq` and this column is never a filter.

**Backfill for it: none, and `NULL` means what the screen already does.** Every existing row keeps
`NULL`, and `NULL` renders each trip in that trip's own accounting currency — which is exactly what
`/trips/$tripId/costs` renders at HEAD. The migration therefore changes no pixel for any existing
reader, and the first non-null value can only arrive from the one control this stage ships. The
previous Worker keeps working against the new table because it never selects the column.

`expenses` needs no migration and **no new write path**. `original_amount_minor`,
`original_currency` and `exchange_rate` exist (`schema.ts:793-795`), `drizzle/0001_aspiring_cargill.sql:14`
created them, and `toRepoInput` (`src/server/fns/costs.ts:258-301`) has been filling them since. This
stage adds nothing to the expense writers and reverses nothing about them; what it does to `expenses`
is read them, in `findLatestFrozenRate`, to suggest a converted figure the reader can overwrite. The
gap this stage closes is the **settlement** half of the same rule, plus the display-currency
preference that has no home at all today.

No new table. Money stays integer minor units plus `text(3)`; ids stay `newId()`; dates stay
`YYYY-MM-DD` text.

### Server (repo, server function, Zod)

**The rule this stage does not touch, restated so nobody re-opens it.** A stored `exchange_rate` is
**derived from the amount pair, never accepted from the client**. `toRepoInput`
(`src/server/fns/costs.ts:283-301`) computes it with `impliedRate()` from the source amount and the
converted amount, and the module comment beside it gives the reason: an amount pair and a rate that
disagreed would put a lie under the row, and the amounts are the half the reader can actually see.
`formatExchangeRate` (`src/lib/money.ts:189-212`) derives the printed line the same way. Every part
of this stage obeys that rule, and so does every later stage in this file: **no writer of a single
expense or settlement ever gains a rate parameter.** There is exactly one place in this plan where a
reader supplies a rate directly, and it is `04-S5`'s whole-trip re-basing — an explicit, previewed,
confirmed operation that moves every row of a trip at once, not a field on a receipt form. It is
called out here so the contrast is deliberate rather than an inconsistency somebody discovers later.

**Repository — `src/server/repos/rates.ts` (new).** Where a _suggested_ rate comes from, and the seam
where a _live_ one will one day come from. All SQL is here.

- `findLatestFrozenRate(scope, { tripId, from, to })` — the most recent rate this workspace has
  already used for that ordered pair, read from the frozen `exchange_rate` on `expenses` and, after
  `00-S1`, on `settlements`. Built on `tenantFilter()`, so the query starts from
  `eq(expenses.organizationId, scope.ctx.organizationId)` and the trip predicate is `AND`-ed onto it;
  a rate from another tenant is unreachable rather than merely unlikely. Returns
  `{ rate, source: 'recent', observedOn } | null`. **No per-row writer reads it.** Its two consumers
  are the pre-filled converted figure described under **UI** — which the reader sees, can overwrite,
  and which is discarded the moment they type over it — and `resolveRate` below, which reaches it on
  behalf of the display conversion and of `04-S5`'s previewed whole-trip re-basing. Neither of those
  is a receipt form, and neither can put a rate on a row a reader did not confirm.
- `resolveRate(scope, { from, to, on, manual? })` — the seam. It consults, in order: a rate the
  caller was given by a reader (`source: 'manual'`, used only by `04-S5`'s whole-trip re-basing),
  then `findLatestFrozenRate`, then the KV cache under `fx:<from>:<to>:<date>`, then the injected
  `RateSource` port. **The port has no implementation in this stage**; see **Blockers**. It returns
  `null` when nothing answers, and it never invents, extrapolates or rounds a rate into existence.
  **It is never reached from a per-row writer.** Its two callers across this whole plan are the
  display conversion in `loadCosts`, which changes what a figure looks like and never what is
  stored, and `changeTripCurrency` in `04-S5`, which the reader confirms against a preview. The unit
  test below pins that call graph so a later stage cannot widen it by accident.
- `getDisplayCurrency(scope, userId)` and `setDisplayCurrency(scope, code | null)` — the reader's
  display preference, read from and written to the single `user_settings.display_currency` column
  filed under **Data and migration**. They live here rather than in `src/server/repos/settings.ts`
  for the ownership reason set out below, and they are the module's only writes: nothing else in
  `rates.ts` writes a row at all. `setDisplayCurrency` resolves the row by
  `organization_id` **and** the caller's own `user_id` inside the scope, and stores `NULL` for "each
  trip in its own currency" rather than a reserved code.
- The KV read/write follows the shape `src/server/billing/entitlements.ts:110-136` already
  established: a malformed or stale-shaped entry is a miss, never an error, and the TTL is a named
  constant beside the reason for its length. Only the rate path uses it: a preference is one row read
  by primary key and is never cached, so it can never be stale.

**Repository — `src/server/repos/expenses.ts` (edit).** **One** writer changes, and it is the
settlement writer.

- `createExpense` and `updateExpense` are **not edited**. They already write the source triple
  (`src/server/repos/expenses.ts:98-100`), the dialog already produces it, and the drop-if-same-code
  rule already lives in `toRepoInput`. A stage that rewrote them would be reimplementing a shipped
  path and would have to justify the reversal of the derived-rate decision above; it has no such
  justification, so it makes no such edit.
- `createSettlement` gains the same three fields the expense writer already has: optional,
  all-three-or-none, `original_amount_minor` a non-negative integer, and `exchange_rate` **derived**
  by the same `impliedRate()` from the pair `(original_amount_minor, amount_minor)` rather than
  supplied. This is the guard `00-S1` places here; this stage is its first caller. When the payment
  currency equals the trip's, all three are `NULL` — one representation for "no conversion happened",
  never two.
- **A settlement in a currency the reader cannot convert is refused, not guessed.** The payment
  dialog asks for the converted figure exactly as the expense dialog does, so the pair always exists
  by the time a write leaves the client; a submitted body carrying a foreign `original_currency` with
  no converted amount fails the all-three-or-none refinement and raises
  `RepositoryError('...', 'CONVERSION_INCOMPLETE')`, and nothing is written. `wiki: Currencies`
  describes storing the row unconverted and converting later at live rates; we do not, because a
  `NOT NULL amount_minor` in the accounting currency has no honest value in that state and every
  balance on the screen would silently under-count. The reader is asked for the figure their
  statement shows instead, which is information they have in their hand.

**Server functions — `src/server/fns/costs.ts` (edit).**

- `loadCosts` gains `displayCurrency: { mode: 'per-trip' | 'fixed', code: string }` and, per expense
  and per settlement, a `convertedMinor` for the reader's display currency beside the source triple
  it already returns (`costs.ts:369-371`). The conversion is applied once, after netting, exactly as
  the convention above requires, through `convertMinor()` in `src/lib/money.ts`. In `per-trip` mode
  `convertedMinor` equals `amountMinor` and no rate is consulted at all.
- `loadCosts` also gains `suggestedRate`, the `findLatestFrozenRate` result for the trip's currency
  against each code the reader has used on this trip, so the dialog can pre-fill without a second
  round trip. It is nullable and the screen renders correctly when it is `null`.
- `recordPaymentFn` stops hard-coding `currency: trip.currency` (`costs.ts:470`) and accepts the
  optional source pair `{ originalAmountMinor, originalCurrency }` — the pair, never a rate, for the
  reason at the top of this section. Its existing mirror is unchanged: it already tells the room the
  trip's money moved (`costs.ts:477-480`) rather than sending a phantom entity, and no new patch kind
  is declared.
- `setDisplayCurrencyFn` (new, `method: 'POST'`) persists the reader's choice: a body of
  `{ code: string | null }`, `code` validated by the existing `currencySchema`
  (`src/server/repos/validation.ts:55`) when present, and `null` for "each trip in its own currency".
  It calls `setDisplayCurrency` in `src/server/repos/rates.ts` and touches nothing else. It writes
  the caller's **own** row and never accepts a user id from the body: the row is resolved from
  `appScope()`, because a well-formed user id is not a permission to write that user's preferences.
  It lives in `src/server/fns/costs.ts` because that is the module this stage owns and the only
  screen that offers the control is the costs screen; the two settings modules are held by `02-S2` in
  this same wave and are not touched.
- `createExpenseFn` and `updateExpenseFn` are **not edited by this stage**. Their currency inputs are
  complete.

**Zod (v4 idiom).** `z.strictObject()` with the `error` parameter; `z.iso.date()` for `settledOn`;
the existing `currencySchema` (`src/server/repos/validation.ts:55`) for every code. The payment
input's source pair mirrors `expenseBodySchema`'s (`src/server/fns/costs.ts:175-180`) exactly, so
there is one description of "a foreign amount" on the client, with a refinement holding
all-three-or-none. **No schema in this stage accepts a rate**, which is the boundary-level expression
of the derived-rate rule. Validation is shape; it decides nothing about permission.

**Authorisation** is decided in the handler, in the repository's scope, and nowhere else. Every
server function resolves `appScope()` and re-resolves the trip through `requireTrip()`; a trip id
from the browser is a claim, not an authorisation, and a foreign one is a `NotFoundError`. Nothing
here is slow enough to enqueue, and nothing new goes to `TASKS`.

**The display preference gets a column of its own, and the reason is a measurement rather than a
preference for tidiness.** An earlier revision of this stage stored it in `user_settings.currency`
(`src/server/db/schema.ts:1836`) with ISO-4217's `XXX` — "no currency" — as a sentinel meaning "show
each trip in its own currency", and asserted that the column's one existing consumer was unaffected.
It is not. That column is already spoken for, and the shipped surface that speaks for it contradicts
the sentinel three separate ways:

- **It already means something else, on screen, in words.** `src/routes/_app/settings/index.tsx:261-263`
  labels it **Currency** with the hint "New trips start in this currency; each trip can override it."
  That is the accounting default a new trip inherits, and it is what `getEffectiveSettings()` returns
  as `currency` (`src/server/repos/settings.ts:254,277`). Two meanings on one column is how a
  preference screen starts lying to the reader about what they chose.
- **The sentinel cannot be rendered by the control that owns the column.** The value is bound raw
  into a `SimpleSelect` (`src/routes/_app/settings/index.tsx:266-274`) whose options are
  `withDefault(CURRENCIES, …)` — the follow-the-workspace option (`:148-156`) plus nine ISO codes
  (`:49-58`). `XXX` is in neither list, so a stored sentinel matches no option and the control falls
  back to its placeholder: the reader is shown an empty currency field they never emptied, on a
  screen this stage does not own and could not fix.
- **A save on an unrelated field would silently delete it.** `regionalSettingsInput`
  (`src/routes/_app/-server/settings.ts:185-192`) carries `currency: optionalOverride` and the writer
  persists all six overrides together, so the next time the reader changes their time zone the
  sentinel is overwritten with whatever the currency picker was showing. A preference another screen
  destroys without mentioning it is worse than no preference at all.

So the sentinel is dropped and the nullable `user_settings.display_currency` column filed under
**Data and migration** carries it instead. Two stored states, and no reserved code doing duty as a
flag:

| Stored value     | Meaning                                                                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NULL`           | No preference. Every trip's figures render in that trip's own accounting currency (`trips.currency`). This is what the screen does at HEAD and what every row holds after the migration. |
| An ISO-4217 code | Render every trip's figures converted into that code. When it equals the trip's own currency nothing converts and no rate is consulted.                                                  |

`resolveDisplayCurrency({ preference, tripCurrency })` in `src/lib/money.ts` is the only reader of
that distinction: pure, no I/O, returning `{ mode: 'per-trip' | 'fixed', code }` — the exact shape
`loadCosts` puts in its payload. `user_settings.currency` keeps precisely the meaning its screen
gives it, `getEffectiveSettings()` is not edited, and `regionalSettingsInput` is not widened.

**The menu offers three choices over those two states, and says which is which.** "Each trip in its
own currency" writes `NULL`. The workspace's own default, named with its code, writes that code — and
the item says the code it is writing, because a menu item that promised to _follow_ an admin setting
would be promising a link this column does not have. Any code this trip has already frozen a rate
against is offered and enabled. Every other code in `CURRENCY_OPTIONS` is rendered **disabled with
the reason in its description**, which is the half `04-S7` unblocks.

**Where the column is read and written, and why not through the settings repository.** Both settings
modules are held in this same wave by `02-S2` (`02-places-and-maps.md`) — measured, not assumed; see
**Owned paths** — so this stage edits neither, and it needs to edit neither:

- **Read.** `getUserSettings(scope, userId)` (`src/server/repos/settings.ts:194`) already returns the
  whole row through `userSettingsRepository.findOne`, so the new column arrives in its result the
  moment the migration lands and the module needs no edit for it. `loadCosts` imports that function
  and edits nothing in the module it comes from. It returns `null` for a member who has never had a
  settings row written, and `null` reads as "no preference" — the same state a `NULL` column means, so
  the two absences do not need telling apart.
- **Write.** One function, `setDisplayCurrency(scope, code | null)`, in `src/server/repos/rates.ts` —
  the module this stage mints — and it is written against a precedent rather than invented:
  `markUserOnboarded` (`src/server/repos/settings.ts:224-234`) is already a one-column writer on this
  table that calls `ensureUserSettings` and then `userSettingsRepository.requireUpdate(scope, row.id,
…)` without going through `updateUserSettingsInput`. `setDisplayCurrency` does exactly that, for
  exactly one column, through the same tenant-scoped handle (`settings.ts:57`) — so the SQL still
  lives in `src/server/repos/` as `docs/SPEC.md` §6 requires, the row is resolved by
  `organization_id` + `user_id` inside the caller's scope before it is touched, and the only thing
  that differs from the precedent is which module the function is declared in.

`updateUserSettingsInput` (`src/server/repos/settings.ts:124-136`) is deliberately **not** widened
and `display_currency` is deliberately absent from `regionalSettingsInput`. That absence is the
guard: the regional form cannot touch the display preference even by accident, `02-S2` (wave 1),
`09-S8` (wave 3) and `03-S6` (wave 4) each widen that input for their own field without ever meeting
this stage, and the repository has exactly one writer of this column.

**Two sibling stages that live near this column, and what each of them actually says.** `09-S8`
(`ACC-04`, `09-account-and-settings.md`, wave 3) ships the regional **accounting** override and
states in its own brief that it "writes **no** rate, performs **no** conversion, and re-bases
**nothing**" — so it neither ships nor needs this preference, and nothing here obliges it to. If a
later run wants the display preference on that screen as well, the file and the wave are `09-S8`'s
and the resolver is the one above rather than a second opinion. And `COL-10` (`07-S6`'s guest viewer,
`07-collaboration-and-sharing.md`) resolves the sharer's `user_settings.currency` and then
`trips.currency`, and performs no live conversion at all; since this stage leaves that column's
meaning exactly as it found it, the guest viewer resolves the same value after this stage as before.

### UI (route, components)

**Route.** None added and none edited. `/trips/$tripId/costs` already exists and its loader already
calls `loadCosts`. No route file changes, so `pnpm generate-routes` does not run and
`src/routeTree.gen.ts` is untouched.

**Components — all existing primitives, no new ones, and one shipped control deliberately left
alone.** `SimpleSelect` for the currency pickers (the curated `CURRENCY_OPTIONS` list, 32 entries,
already in `src/lib/money.ts:40`), `Input` for the converted amount, `Field` for
label/hint/error, `DropdownMenu` for the display-currency menu, `Badge` for the display-currency
indicator, `Tooltip` for the suggestion's provenance, `Alert` for the fallback notice, `Button` and
`Spinner` for the submit state. No primitive is filed to `00-foundations.md`, because none of the 42
shipped modules is missing.

**What is NOT rebuilt.** The expense dialog's currency control — the `SimpleSelect` at
`expense-dialog.tsx:318-329`, the revealed "Converted to `<trip currency>`" `Input` at `:332-356`,
and the `formatExchangeRate` hint under it — is shipped, correct and stays exactly as it is. So does
the decision recorded in that module's own docstring (`expense-dialog.tsx:9-14`): the reader types
the converted figure and the rate is derived from the pair, because inventing a rate would put a
number on the screen nobody can reconcile against a bank statement. **This stage introduces no rate
input anywhere.** An implementer who finds themselves writing one has misread this stage.

Three surfaces change, and only in the ways listed:

- **Expense dialog — one addition, no replacement.** When the picked currency differs from the trip's
  and the converted field is still empty, the field is **pre-filled** with the amount implied by
  `findLatestFrozenRate` for that ordered pair, and a quiet `Field` hint names where the figure came
  from ("from the rate you used on 12 May" — the `observedOn` the repository returned). The value is
  a plain suggestion in an editable field, not a computed read-only figure: typing over it replaces
  it, and the existing `impliedRate` derivation then runs on whatever the reader actually left there,
  unchanged. When there is no prior rate the field stays empty and the dialog behaves exactly as it
  does at HEAD. Both figures already carry `tabular-nums` (`expense-dialog.tsx:313,352`) and keep it.
- **Payment dialog.** Gains the currency pair the expense dialog already has, in the same shape and
  with the same copy discipline, because a payment in a foreign currency is the same question asked
  about a different row: a `SimpleSelect` beside the amount, and a revealed converted field with the
  derived rate as its hint. It is a foreign-currency field set the payment dialog does not have today
  (`payment-dialog.tsx:208-220` offers only the trip currency), so this is new work and not a rebuild.
  `wiki: Currencies` states the same rule for payments and this is where we honour it.
- **Toolbar.** A compact display-currency indicator — the code the figures on screen are in — and a
  `DropdownMenu` behind it with the three choices the server section fixes: "Each trip in its own
  currency" (writes `NULL`), the workspace's default named with its code, and every code this trip
  has already frozen a rate against. Choosing one calls `setDisplayCurrencyFn` and reloads the
  payload. Codes that would need a live rate are rendered **disabled with the reason in their
  description**, not hidden — a control that silently omits the thing a reader is looking for is
  worse than one that explains itself. The indicator is the selector
  `[data-part="display-currency"]`, which `04-S7` re-uses to photograph those same options once they
  are enabled.

**States, named rather than gestured at.**

- _Empty_ — the converted field does not exist until the currencies differ, so there is no empty
  converted state; when it does exist with no prior rate to suggest, its placeholder is the existing
  zero-amount placeholder and its hint is the existing statement copy. The screen-level empty state
  (`screen.tsx:267`) is untouched and its copy already names the trip currency.
- _Skeleton_ — `CostsSkeleton` (`-costs/skeleton.tsx`) already reserves the toolbar's room. The
  display-currency indicator is inside that reserved block, on `--color-surface-2`, so nothing
  reflows when the payload lands. `04-S2` owns that file; this stage confirms the shape fits and
  files nothing.
- _Error_ — two, and neither of them blocks a half-typed receipt. In the dialogs, an unparseable
  converted amount keeps the existing inline `Field` error (`expense-dialog.tsx:341-344`) and the
  payment dialog gains the identical one; the dialog stays open with the reader's input intact,
  because a refusal that discards a half-typed receipt is a worse bug than the thing it refused. On
  the screen, a display currency that cannot be resolved renders an `Alert` on `--color-surface-2`
  above the ledger, stating the pair and the date it could not resolve, and the screen falls back to
  per-trip rendering rather than showing a converted figure it cannot stand behind.
- _Loading_ — the submit button carries `loading` while the write is in flight; the currency picker
  and the converted input are `disabled` for that window, so the pair cannot change under a request
  that has already left. The display-currency menu carries its own `loading` while the reloaded
  payload is in flight, and the figures it will replace keep their current values rather than
  blanking.

**Tokens.** None missing. Colour, spacing, radius, shadow, easing and z-index all resolve from
`src/styles/tokens.css`; no hex, no one-off margin, spacing on the 4px grid from `--space-*`. Motion
on the revealed converted row is 220ms `--ease-out-quint` in, 150ms out, opacity and transform only,
and collapses under `prefers-reduced-motion: reduce`.

### Quota

**This stage creates no countable row.** It adds fields to `expenses` and `settlements` rows that an
existing write path already creates, and it sets one column on the reader's own `user_settings` row,
which `ensureUserSettings` (`src/server/repos/settings.ts:202`) already creates for every member on
first read. None of the three tables is metered: `USAGE_METRICS` and `PLAN_QUOTAS`
(`src/server/db/types.ts:41`) carry `places`, `files`, `exports`, `collections` and `journeys`, and
the catalogue sells `members`, `trips` and `storage_bytes`. Expense volume is bounded by trip count,
which is metered upstream in `trips.createTrip`.

No entry is added to `resolveLimits()`, none to `PLAN_QUOTAS`, and therefore no case to
`src/server/billing/__tests__/limits.test.ts`. One operational note for whoever adopts a rate
provider in `04-S7`: a metered outbound call made on a tenant's behalf is a cost a noisy tenant can
inflict on every other, and its ceiling belongs in `resolveLimits()` like any other — never in a
constant inside this module.

### Tenant isolation test

Appended to `src/server/repos/__tests__/tenant-isolation.test.ts` as one `describe` block that edits
no existing block.

In organization A's scope, against organization B's rows: read, list, update and delete B's
settlement by id; record a settlement carrying the three new source fields onto B's trip; and ask
`findLatestFrozenRate` for a pair on B's trip. Every one is a `NotFoundError`, and B's rows are
byte-identical afterwards. Then the mirror case: A's own new settlement is read back in B's scope by
id and is a `NotFoundError`.

The display preference gets its own case in the same block, because it is the one write this stage
makes outside the money tables. A user who is a member of both organizations has a `user_settings`
row in each: setting a display currency in A's scope changes A's row and leaves B's row
byte-identical, and reading it back in B's scope returns B's value rather than A's. Then the
crossing case: `setDisplayCurrency` called in A's scope for a user who is a member of B only writes
nothing and raises `NotFoundError` — the row is resolved by `organization_id` **and** `user_id`
inside the scope, so a foreign membership is unreachable rather than merely unlikely.

Functions covered: `findLatestFrozenRate`, `resolveRate` and `setDisplayCurrency` in
`src/server/repos/rates.ts`; `createSettlement` in `src/server/repos/expenses.ts`. `createExpense`
and `updateExpense` are not covered here — they are unchanged by this stage and their isolation cases
already exist in that file.

The rate cache gets its own assertion, because it is the one thing here that is deliberately shared:
a cache key is a currency pair and a date, which is a public fact and correctly shared across
tenants — but `findLatestFrozenRate` reads tenant rows and its result is never written to that cache.
The test asserts a key derived from tenant data cannot be constructed by the module.

### Verification

**Command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests, by file and invariant.**

- `src/lib/__tests__/money.test.ts` (edit) — the conversion arithmetic. `1000 JPY` minor to `EUR`
  minor and back is not off by a factor of a hundred; a three-digit currency (`KWD`) converts
  correctly in both directions; conversion rounds half-up exactly once; `convertMinor(x, 1, c, c)`
  is the identity for every currency in `CURRENCY_OPTIONS`; and `resolveDisplayCurrency` returns
  `mode: 'per-trip'` with the trip's own code for a `NULL` preference, `mode: 'fixed'` for a stored
  code, and `mode: 'per-trip'` again when the stored code equals the trip's own — the case that must
  consult no rate. No reserved code is a control value anywhere in the function, which is the
  regression test for the sentinel this stage removed.
- `src/server/repos/__tests__/rates.test.ts` (new) — `resolveRate` prefers a manual rate over a
  frozen one, a frozen one over the cache and the cache over the port; it returns `null` rather than
  a guess when nothing answers; a malformed cache entry is a miss and not a throw;
  `findLatestFrozenRate` returns the most recent observation and ignores rows from another trip.
  `setDisplayCurrency` round-trips a code and round-trips `NULL`, and writing `NULL` after a code
  restores the per-trip rendering rather than leaving the previous code behind — the state machine
  has two states and both are reachable in both directions. And
  the rule at the top of the server section, pinned as a test rather than left as prose: no export of
  `rates.ts` is reachable from `createExpense`, `updateExpense` or `createSettlement`, so a later
  stage cannot quietly make a stored per-row `exchange_rate` come from anywhere but the amount pair.
- `src/components/costs/__tests__/data.test.ts` (edit) — the export gains its display-currency column
  in the right position, the column equals the accounting amount in per-trip mode, and the file still
  leads with its byte-order mark.
- The settlement `NULL`-triple reading: a pre-`0002` settlement round-trips as "no conversion, rate
  1" and `getMemberBalances` still clears to zero on a trip that mixes converted and unconverted
  payments.

**Browser evidence.** Spec file `e2e/budget-and-currencies.visual.spec.ts`, `describe` block named
`04-S1 — payment currency and display currency`. It imports `visit`, `settle`, `shoot`, `applyTheme`, `THEMES`,
`useSession` and `watchConsole` from `./helpers/shoot.ts` and re-implements none of them, and it
calls `auditServerClock(page, <this spec's own route table>)` once in a `describe` of its own,
because a route declared in a module spec is in nobody else's `APP_ROUTES`.

- Route: `/trips/$tripId/costs` on the seeded demo trip.
- Frame set: light and dark at **360px, 1280px and 2560px** — six frames at rest.
- **Declared non-resting state**, because the point of this stage is a control that does not exist
  until a currency differs — and it is the **payment** dialog, since that is the surface this stage
  gives a currency pair to. The payment dialog open on a foreign-currency payment, with the converted
  field revealed and its derived rate hint showing. The dialog is opened through the settle-up
  panel's existing `Settle` button (`-costs/rail.tsx:159-169`), which this stage neither owns nor
  changes; the currency is then switched through `[data-part="payment-currency"]`, the control this
  stage does ship. Two clicks, so this set is the spec's rather than `capture.mjs`'s — see the
  harness block below — and its frames are named `foreign-payment-<width>-<theme>.png`. Six more
  frames. The expense dialog
  is **not** a declared state of this stage: its foreign-currency layout ships at HEAD and this stage
  changes only the initial value of one field, so photographing it would be evidence about somebody
  else's work.
- `[data-part="payment-currency"]` is a stable attribute this stage ships, and the stage verifies it
  against a running server with `page.locator(sel).count()` returning 1 **before** capture. Reading
  the JSX and believing it is not a verification. The `Settle` button it is reached through is
  located by its accessible name rather than by a `data-part` this stage would have had to add to a
  file it does not own.
- The display-currency fallback notice is reached with `page.route()` failing the rate lookup, not by
  waiting for a real failure.

**Console must be silent.** `watchConsole(page, route)` is attached before navigation and its `fatal`
list is asserted empty at the end of every test in the block, frame-only tests included. Nothing is
added to `TOLERATED_CONSOLE_WARNINGS`; a warning this stage's code emits is this stage's bug.

**No layout shift after paint.** A `PerformanceObserver` for `layout-shift` is installed as an init
script, accumulating `entry.value` where `hadRecentInput` is false; `visit()` then `settle()`, then
`performance.now()` as the mark; then the dialog is opened and the currency changed; then the sum of
entries after the mark is asserted to be `0`. The assertion is gated on
`PerformanceObserver.supportedEntryTypes` including `layout-shift`, so the `mobile-safari` project
records a stated skip rather than a false pass, and the value is reported either way.

**The harness, quoted in full**, so the port, the session refresh and the clock pin are visible
here rather than inherited from a sentence elsewhere. `2026-08-20` is `BASELINE_DAY`, and
`capture.mjs` installs its header interceptor only when `PT_SERVER_TODAY` is set
(`scripts/ultrabuild/capture.mjs:168-169`), so an unset pin shoots a different day than the gate
compares.

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)

PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/budget-and-currencies.visual.spec.ts
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/budget-and-currencies.visual.spec.ts --update-snapshots -g '04-S1'

PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/$TRIP_ID/costs" \
  --out ".claude/ultrabuild/shots/04-budget-and-currencies/round-<n>/04-S1" \
  --label B --auth \
  --viewports 360x800,1280x900,2560x1440 --themes light,dark
```

**The two non-resting sets are the spec's, not `capture.mjs`'s, and the reason is measured.**
`foreign-payment` is two clicks from rest — the settle-up panel's `Settle` button, then
`[data-part="payment-currency"]` — and `capture.mjs` applies at most one `--click` per invocation
(`scripts/ultrabuild/capture.mjs:218-224`). The fallback-notice set needs `page.route()` to fail the
rate lookup, which no capture flag reaches. Both are therefore driven inside this plan's spec, the
route `12-verification-protocol.md` §3 sanctions alongside the flags, and each frame is written with
`page.screenshot({ path: testInfo.outputPath(name) })` — `name` being `foreign-payment-<width>-<theme>.png`
— into `test-results/` (`playwright.config.ts:51`) and copied into the same round and stage directory
as the resting set. Six frames each, at the same three widths in both themes.

### Definition of done

The six repository-wide items of `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm
lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test`
passes; the feature is visually verified in a real browser, light and dark, desktop and mobile; no
TODO, placeholder copy, `console.log` or commented-out code is left behind; and no file outside
**Owned paths** is touched.

On top of those, the `docs/SPEC.md` §2 visual clauses, ticked for every surface this stage ships:

- [ ] Spacing on the 4px grid from `--space-*`, no eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states — the
      payment dialog's currency `SimpleSelect` and converted `Input`, the display-currency menu and
      the submit `Button`.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each on
      `--color-surface-2`.
- [ ] Motion 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured.
- [ ] Full parity in light **and** dark, with dark shadows re-declared rather than reused.
- [ ] Responsive 360px → 2560px, where 360px is a designed layout — the converted row stacks under
      the amount rather than being squeezed beside it, and the toolbar's display-currency control
      collapses to its code alone.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.
- [ ] `font-variant-numeric: tabular-nums` on every amount, rate and percentage this stage renders.

### Blockers

**One, and it is a commercial decision rather than an engineering one.**

- **No foreign-exchange rate provider is chosen, and none may be chosen here.**
  `11-boundaries-and-blockers.md` (`11-S3`) records the constraint: a tier whose terms exclude a
  commercial, subscription-funded product is unusable to us at any traffic level, and what a provider
  permits us to **cache**, and for how long, decides the cost more than the per-call price does.
  Disposition: **defer**. This stage builds the `RateSource` port, the KV cache around it and every
  surface that consumes a rate, and ships with the two sources that need no provider — the converted
  figure the reader reads off their own statement, which is what a stored rate is derived from today
  and stays so, and the most recent rate this workspace already used for that pair, offered as a
  suggestion. It does not write a client for an unnamed service and does not degrade into inventing a
  rate.
  When the decision lands, `04-S7` implements the port and nothing above it changes.

No package outside the `docs/SPEC.md` §3 pinned set is needed: the conversion is arithmetic, the
formatting is `Intl`, the cache is the `KV` binding that already exists.

**No new binding and no new cron trigger is required either**, and that is checkable against
`wrangler.jsonc` rather than borrowed from another plan. `11-boundaries-and-blockers.md` (`11-S3`)
registers `BROWSER`, `AI` and the image-transformation binding as the three absent ones and lists
`KV` among the seven already declared; it says nothing about cron triggers, and this stage does not
put words in it. `wrangler.jsonc:107-114` declares three triggers — the quarter-hourly reminder
sweep, a nightly export and a weekly prune — and a cached rate needs none of them, because it expires
on its own KV TTL and is re-fetched by the next reader who needs it. Adding a fourth would in any
case be an edit to `wrangler.jsonc`, a shared path that no stage in this file names.

**One precondition inherited from the harness, recorded here because `12-verification-protocol.md`
§7.2 requires the stage that baselines a trip tab to carry it rather than absorb it.** Every stage in
this file baselines `/trips/$tripId/costs`, which is a trip tab, and seven call sites still construct
their own `Intl.DateTimeFormat` with `month: 'short'` — two of them in `src/components/costs/data.ts`
— which workerd and WebKit abbreviate differently. Disposition: **report**. None of those files is in
this stage's **Owned paths**, so it repairs none of them; it widens no diff budget, which §5 of the
same file forbids outright; and it attributes a `mobile-safari` difference of that shape rather than
re-recording a baseline over it. §7.3 rides with it: nothing in the repository pins the browser
revisions behind these baselines, so a green comparison proves this stage changed nothing on this
machine and is not a claim about a second one.

## Stage 04-S2 — Let a trip name its own cost categories

### Stage id

`04-S2` · Wave 1 · effort **L**. Wave 1 alongside `04-S1`; the two share no file except the visual
spec, under the rule stated in the brief above.

### Reference rows

- `MNY-01` partial → **done**. Today `EXPENSE_CATEGORIES` (`src/server/db/schema.ts:192`) is a fixed
  eight-value list enforced by a generated SQL CHECK and mapped to labels in
  `src/routes/_app/trips/$tripId/-costs/categories.tsx`. A traveller cannot add "diving", cannot
  rename "fees" to something their trip actually calls it, and cannot order the list the way their
  spending falls. This stage gives the trip its own category entity with inline add, rename,
  drag-reorder, a delete that names its consequence, and a stable colour shared with the chart
  `04-S4` draws.

**One behaviour of this row is deferred, to `04-S3` in wave 2, and the reason is an ownership
measurement rather than a preference.** Filing an expense into a trip-defined category is a write to
`expenses.cost_category_id`, and that column can only be written from the expense writers —
`createExpense` and `updateExpense` in `src/server/repos/expenses.ts`, reached through
`createExpenseFn` and `updateExpenseFn` in `src/server/fns/costs.ts`. Both modules are held
**exclusively in wave 1** by `04-S1`, whose own **Owned paths** take them for the settlement-currency
work and say in the same breath that it touches neither expense writer. A second exclusive wave-1
claim on either module would clobber that edit, which is exactly what
`node scripts/ultrabuild/check-plan-collisions.mjs 04` exists to catch, so this stage claims neither
module. `04-S3` is the first stage that can: it is wave 2, it already owns both, its **Server**
section already carries `costCategoryId` as a nullable id re-resolved through this stage's
repository, its **Tenant isolation test** already carries both cross-tenant category cases, and its
**Verification** already carries the `NULL`-resolves-to-the-legacy-label test. Nothing new is asked
of `04-S3`; what changes is that this stage stops claiming that half.

**What wave 1 therefore actually ships, stated so nobody reads more into this stage than it
delivers.** A trip owns its categories — add, rename, reorder, delete with a named consequence, a
stable palette index — and every surface that groups money renders an expense's grouping through the
resolver this stage ships: `cost_category_id` when it is set, the eight-value `category` enum through
the existing label map when it is not. Until `04-S3` lands, `cost_category_id` is `NULL` on every
row, so every expense resolves through the enum and the screen renders what it renders at HEAD plus
the reader's own categories beside it. Two consequences follow, and both are designed for rather than
discovered:

- The delete dialog's count is real and reads `0` for every category in wave 1, because nothing can
  file an expense into one yet. That is the truth about the data, not a placeholder, and the dialog
  says so in words rather than pluralising a zero.
- `deleteTripCostCategory`'s reassign and remove branches are SQL against `expenses` and can live
  nowhere but a repository, so they land here with the rest of this entity's SQL rather than waiting
  for `04-S3`. They are exercised in wave 1 by `src/server/repos/__tests__/cost-categories.test.ts`
  against rows the test seeds directly, and become reachable from the product the moment `04-S3`
  lands the writer edit. Writing them now is the point: a delete path that learns about filed
  expenses one wave after the column exists is a delete path that orphans rows in between.

Sourced from `wiki: Budget-Tracking`.

`04-S3` and `04-S4` both depend on this stage and are in the next wave, which is why it is here.

### Owned paths

- `src/server/repos/cost-categories.ts` — new. All SQL for the category entity.
- `src/server/repos/__tests__/cost-categories.test.ts` — new.
- `src/server/fns/cost-categories.ts` — new. The five endpoints.
- `src/routes/_app/trips/$tripId/costs.tsx` — edit. The route's search schema only.
- `src/routes/_app/trips/$tripId/-costs/categories.tsx` — edit.
- `src/routes/_app/trips/$tripId/-costs/category-editor.tsx` — new.
- `src/routes/_app/trips/$tripId/-costs/category-model.ts` — new. The pure half of this stage: the
  grouping resolver described above, and the mapping from a row to the palette position its swatch
  class comes from. It **calls** `swatchFor()` (`src/routes/_app/-lib/tone.ts:157`), which already
  cycles with `index % CATEGORY_SWATCHES.length`, and re-implements neither that function nor the
  array behind it — a second swatch resolver would be the defect, and `tone.ts` is the foundations
  stage's to extend, not this one's. No JSX and no import of `#/components/ui`, so the module is
  collectable by the `server` project; `tone.ts` is a module of class-name strings and imports
  nothing that needs a DOM. `src/routes/_app/-ui/plan-model.ts` is the precedent for a route-local
  model module beside the screen that uses it.
- `src/routes/_app/trips/$tripId/-costs/__tests__/category-model.test.ts` — new. `.ts` and not
  `.tsx` on a measurement: `vitest.config.ts:49-51` includes `src/routes/**/*.test.ts` in the
  **node** project only, and the `ui` project's globs (`:35-36`) reach `src/components/**` and
  `src/lib/**` and never `src/routes/**`. A `.test.tsx` under this directory would be collected by
  nothing and would pass by never running.
- `src/routes/_app/trips/$tripId/-costs/screen.tsx` — edit.
- `src/routes/_app/trips/$tripId/-costs/expense-list.tsx` — edit.
- `src/routes/_app/trips/$tripId/-costs/actions.ts` — edit.
- `src/routes/_app/trips/$tripId/-costs/skeleton.tsx` — edit.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. One new `describe` block.
- `e2e/budget-and-currencies.visual.spec.ts` — append. This stage's own `describe` block, added at
  the end and editing nobody else's.
- `e2e/__screenshots__/budget-and-currencies.visual.spec.ts/` — append. The baseline directory
  `playwright.config.ts:49-50` derives from that spec's file name, so
  `--update-snapshots -g '04-S2'` writes this stage's own frames into it whether the stage
  names it or not. It is named because writing into a path a stage did not declare fails
  `docs/SPEC.md` §7 item 6. `append`, not `edit`: every frame name begins with the stage id, so
  this stage adds its own PNGs and overwrites nobody else's.

`src/routes/_app/trips/$tripId/costs.tsx` is an **existing** route file whose `validateSearch`
schema currently enumerates the eight fixed categories; it is edited, not created, so
`pnpm generate-routes` does not run and the generated route tree is not touched.

**`src/server/do/protocol.ts` is deliberately not claimed, and the reason is a measurement rather
than a preference.** An earlier draft of this stage declared a new `cost-category` entity kind in
that module. Running `node scripts/ultrabuild/check-plan-collisions.mjs 04` showed the cost of that:
`07-S1` (`07-collaboration-and-sharing.md`) takes the same module exclusively **in the same wave**,
and two stages adding an entity kind to one module in parallel corrupt each other. No new kind is
needed, because the product already has the pattern — `recordPaymentFn` mirrors a settlement as
`patch('trip', trip.id, { expensesChangedAt: Date.now() })` (`src/server/fns/costs.ts:478-480`)
rather than inventing an entity for a row the room does not need to reconstruct. This stage does the
same for categories. See **Server** below.

### Data and migration

One new table and one new column, both stated here and executed by `00-foundations.md` in migration
`0002`, which `00-S1` says absorbs every wave-1 requirement so that wave 1 opens against one
migration rather than eleven.

**`trip_cost_categories`** — a category a trip defines for itself:

| Column                      | Type                           | Notes                                                                      |
| --------------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| `id`                        | `text` PK                      | `newId()`, as every table.                                                 |
| `organization_id`           | `text` NOT NULL                | `orgRef()`, cascade on organization delete. Leading column of every index. |
| `trip_id`                   | `text` NOT NULL                | References `trips.id`, cascade.                                            |
| `name`                      | `text` NOT NULL                |                                                                            |
| `colour_index`              | `integer` NOT NULL default `0` | Position in the shared palette, not a hex value.                           |
| `sort_order`                | `real`                         | `sortOrder()`, fractional so a drag needs one write.                       |
| `created_at` / `updated_at` | `integer`                      | `timestamps()`, epoch ms.                                                  |

Indexes: `trip_cost_categories_org_trip_idx` on `(organization_id, trip_id)` and
`trip_cost_categories_trip_sort_idx` on `(trip_id, sort_order)` — `organization_id` leads, as every
composite index in this schema does. One CHECK, `nonNegativeCheck` on `colour_index`. No enum, so no
`enumCheck`.

**`expenses.cost_category_id`** — `text`, nullable, references `trip_cost_categories.id`
**`ON DELETE set null`**. Nullable and set-null are both deliberate: the column is additive, so the
previous Worker keeps reading `expenses.category` and keeps working after a rollback, and a
database-level cascade that silently deletes money rows is not a behaviour any confirmation dialog
can undo. The product's own cascade is explicit and lives in the repository — see below.

**Backfill: none.** No `INSERT ... SELECT`, no `UPDATE`. Existing expenses keep their eight-value
`category` and a `NULL` `cost_category_id`, and the read path resolves an expense's grouping as
_`cost_category_id` when set, otherwise the `category` enum rendered through the label map that
already exists_. That resolver is what this stage ships, in `-costs/category-model.ts`; the write
that can first set the column belongs to `04-S3`, per the deferral under **Reference rows**, and from
that stage on both columns keep being written on every expense write until a later plan retires the
enum, which is not this plan's to do. The enum column is never dropped here, and that is what makes
the rollback honest rather than theoretical: a previous Worker that has never heard of
`cost_category_id` keeps reading `expenses.category` and keeps rendering every row.

A trip's first category write seeds nothing implicitly: the editor's empty state offers a one-click
"start from the standard eight", which is a write the reader asked for. A lazy seed on a **read**
path would be a write nobody requested and a surprise in a tenant's audit trail.

Money is untouched by this stage: `budget_items` and `expenses` keep every amount as an integer in
minor units paired with its own separate `text(3)` ISO-4217 currency column, and a category carries
no amount and no currency of its own — the total rendered in a category header is summed at read time
from the expenses filed under it, in the trip's accounting currency.

### Server (repo, server function, Zod)

**Repository — `src/server/repos/cost-categories.ts` (new).** All SQL for this entity, and nowhere
else.

- `listTripCostCategories(scope, tripId)` — ordered by `sort_order` then `id`.
- `createTripCostCategory(scope, input)` — `sort_order` computed as one past the current maximum,
  `colour_index` as the next position in the palette cycle so two adjacent categories never collide.
- `renameTripCostCategory(scope, id, name)`.
- `reorderTripCostCategories(scope, tripId, orderedIds)` — one `db.batch()`, fractional midpoints, so
  a drag is a single round trip and a partial failure rolls the whole reorder back.
- `deleteTripCostCategory(scope, id, { reassignTo })` — the explicit cascade. In one `db.batch()`:
  either move the category's expenses to another category or delete them, then delete the category.
  The caller must choose; there is no default, because the two outcomes differ by real money.
- `countCategoryExpenses(scope, id)` — what the confirmation dialog names.

Every query is built on `tenantFilter()` from `src/server/repos/base.ts`, which starts from
`eq(table.organizationId, scope.ctx.organizationId)` and lets a caller only `AND` onto it, and the
handle is a `createTenantRepository`, which stamps `organization_id` on insert and omits it from the
caller's payload type. A repository function reachable without a `TenantScope` would be malformed.
`requireTrip(scope, tripId)` re-resolves the parent before any write, so parenting a category onto
another tenant's trip is a `NotFoundError`.

**Server functions — `src/server/fns/cost-categories.ts` (new).** `listCostCategoriesFn`
(`method: 'GET'`) and four `method: 'POST'` writers mirroring the repository verbs, each returning
the minimum the optimistic UI needs to reconcile. Each mirrors to the trip room.

**Zod (v4).** `z.strictObject()` with `error`; `idSchema` for ids; a trimmed `name` of 1–40
characters; `colourIndex` a bounded non-negative integer; `orderedIds` an array with a maximum length
and a uniqueness refinement, so a client cannot ask for a reorder that is not a permutation.

**Authorisation** is decided in each handler: `appScope()`, then `requireTrip()`. `beforeLoad` on the
route is UX and is never the data boundary — every one of these functions is a public endpoint
reachable without the screen that renders it.

**Realtime, and no new patch kind.** Every category write mirrors under the **existing `trip` entity
kind** as a single field — `patch('trip', trip.id, { categoriesChangedAt: Date.now() })` — which is
the shape `recordPaymentFn` already uses for a settlement (`src/server/fns/costs.ts:478-480`) and
the reason `src/server/do/protocol.ts` is not an owned path of this stage. A commit frame is a
signal, not a payload: the client invalidates the router and D1 answers, which is what makes a rename
land on every open tab. That is well inside the measured envelope — 32 KiB per frame, 40 messages per
second per connection, 50 patches per message, 64 fields per patch — because the frame carries one
timestamp. Conflict resolution stays last-write-wins per field on the room's monotonic version, and
the room stays one per trip.

Nothing here is slow. Nothing is enqueued on `TASKS`.

### UI (route, components)

**Route.** `/trips/$tripId/costs`, edited not created. Its `validateSearch` category filter widens
from the eight-value enum to a category id **or** one of the eight legacy names, each still ending in
`.catch(undefined)` so a stale link degrades to the unfiltered view instead of throwing at a reader.
SSR stays the default; the screen is data-shaped, not map-shaped, and has no reason to opt out.

**Components.** Reused from `src/components/ui`: `Input` (inline add and rename), `IconButton` (the
grip, the pencil, the trash), `Button`, `Dialog` (the delete confirmation), `Select` (choose where
orphaned expenses go), `Badge`, `SectionLabel`, `EmptyState`, `Skeleton`, `Tooltip`, `Alert`. Drag
uses `@dnd-kit`, already in the pinned set and already the reordering idiom of
`-ui/plan-screen.tsx`. New product modules, both route-local because both are bound to this screen's
payload: `-costs/category-editor.tsx`, the editor itself, and `-costs/category-model.ts`, the pure
grouping resolver and palette-index lookup it and the ledger both read. No new primitive is filed to
`00-foundations.md`.

**States.**

- _Empty_ — no categories yet: an `EmptyState` on `--color-surface-2` with `Coins`, the line "This
  trip has no categories yet", and two affordances — name the first one inline, or start from the
  standard eight.
- _Skeleton_ — `-costs/skeleton.tsx` gains a category-header row shape (a swatch, a name bar, a
  total bar) repeated three times above the existing row skeletons, on `--color-surface-2`, sized to
  the real header so nothing reflows.
- _Error_ — a failed write rolls the optimistic row back and raises a `sonner` toast naming what
  failed and offering "try again", which re-issues the same write. A reorder that fails restores the
  previous order rather than leaving a half-applied one.
- _Loading_ — the add button carries `loading`; a row being renamed or reordered is `aria-busy` with
  its controls `disabled`, so a second drag cannot race the first.
- _Destructive_ — the delete dialog names the count from `countCategoryExpenses` and requires an
  explicit choice between moving those expenses and deleting them. No default, no silent cascade. The
  count is read from the database rather than illustrated: in wave 1 it is `0` for every category,
  because nothing can file an expense into one until `04-S3`, and the dialog reads "Nothing is filed
  here yet" for that case rather than pluralising a zero.

**Tokens — one requirement filed.** The palette is a **token requirement for
`00-foundations.md`**: `--color-data-1` … `--color-data-8`, plus a `-soft` companion for each,
declared in `src/styles/tokens.css` with dark values re-declared rather than inverted, and every
swatch verified at WCAG 2.2 AA against `--color-surface` and `--color-surface-2` in both themes.
Eight rather than more: a warm neutral canvas will not carry a dozen distinguishable hues at AA, and
a palette that cycles predictably beats one that is merely long. `colour_index` stores the position;
the class comes from the palette map beside `CATEGORY_SWATCHES`
(`src/routes/_app/-lib/tone.ts:148`), which today has six entries built on semantic tokens and is
extended by the foundations stage, not by this one. **This stage hard-codes no hex.**

The foundations register currently records "none required — no wave-1 plan has filed a token
requirement yet". This filing changes that, and it is the only token this plan asks for.

Amounts rendered in a category header — the category's total — carry
`font-variant-numeric: tabular-nums`, as does the count beside it.

### Quota

**Creates a countable row, and deliberately does not meter it.** A cost category is a child of a
trip, bounded by the trip, and the plan catalogue does not sell a category allowance:
`CATALOGUE_METRICS` is `members`, `trips`, `storage_bytes` (`src/server/db/types.ts:28`) and
`PLAN_QUOTAS` carries `places`, `files`, `exports`, `collections`, `journeys` (`:41`). The published
number is the enforced number, and the inverse also binds — a ceiling nobody sells is a ceiling
nobody can discover before they hit it.

So no metric is added to `resolveLimits()`, none to `PLAN_QUOTAS`, and no case to
`src/server/billing/__tests__/limits.test.ts`. The abuse bound is instead a plain input limit
enforced in the repository before the write: a trip may hold at most 60 categories, a named constant
beside the reason for its size, raising `RepositoryError` with a message a reader can act on. That is
a shape constraint, not a plan entitlement, and it is held by a unit test.

### Tenant isolation test

Appended to `src/server/repos/__tests__/tenant-isolation.test.ts` as its own `describe` block.

In A's scope: read, list, update and delete B's categories by id — `NotFoundError` each. Create a
category parented on B's trip id — `NotFoundError`. Reorder using an id list that contains one of B's
category ids — `NotFoundError`, and no partial reorder is left behind. Delete one of B's categories
with `reassignTo` pointing at one of A's — `NotFoundError`, and B's expenses are untouched. Finally,
delete one of A's categories with `reassignTo` pointing at one of B's — `NotFoundError`, and the
delete does not proceed with the reassignment quietly dropped, because a well-formed foreign id is
never silently re-scoped onto the caller's organization.

B's category and expense rows are compared byte-for-byte before and after. Functions covered: all six
exported from `src/server/repos/cost-categories.ts`. The category argument of `createExpense` and
`updateExpense` is **not** covered here and is not this stage's to cover: those two writers belong to
`04-S3`, per the deferral under **Reference rows**, and `04-S3`'s own `describe` block already
asserts both directions of it — patching B's expense onto one of A's categories, and patching one of
A's expenses onto one of B's.

### Verification

**Command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Migration review is part of the gate**, even though the migration belongs to `00-S1`: read
`drizzle/0002_*.sql` and confirm the new table's `organization_id` leads both its indexes, that
`expenses` gained one nullable column and no rebuild, that no `DROP` appears, and that
`drizzle/meta/_journal.json` gained exactly one entry. Then `pnpm db:migrate:local` against a
database already carrying `0000` and `0001`.

**Unit tests, by file and invariant.**

- `src/server/repos/__tests__/cost-categories.test.ts` (new) — a reorder is a permutation and the
  resulting order is stable across a re-read; `colour_index` cycles rather than repeating adjacently;
  the per-trip ceiling raises before the write, not after; and both delete branches, exercised
  against expense rows the test seeds directly with a `cost_category_id`, because no product write
  path sets one until `04-S3` — delete-with-reassign moves every expense of that category and deletes
  none, delete-with-remove deletes exactly the expenses of that category and no others, and each runs
  as one `db.batch()` so a failure in the second statement leaves the category and its expenses as
  they were.
- `src/routes/_app/trips/$tripId/-costs/__tests__/category-model.test.ts` (new) — the grouping
  resolver, both branches: a row carrying a `cost_category_id` resolves to that category's name and
  palette index, and a row carrying `NULL` — which in wave 1 is every row — resolves to the legacy
  enum's existing label. Also that a `colour_index` past the end of the palette still resolves to a
  swatch class — the wrap is `swatchFor`'s, already at `src/routes/_app/-lib/tone.ts:157-159`, and
  the test asserts this stage keeps routing through it rather than indexing the array itself, which
  is the mistake that renders a swatch with no colour token behind it.

**Browser evidence.** `describe` block `04-S2 — trip cost categories` in
`e2e/budget-and-currencies.visual.spec.ts`, using the shared helpers and re-implementing none.

- Route: `/trips/$tripId/costs`.
- Frame set: light and dark at **360px, 1280px and 2560px** at rest.
- **Declared non-resting states**, because add, rename and delete are the point of the stage:
  the inline rename open on a category header, reached by `--click` on
  `[data-part="category-rename"]`, framed as `--state rename`; and the delete confirmation open,
  reached by `--click` on `[data-part="category-delete"]`, framed as `--state delete-confirm`. Both
  selectors are stable `data-part` attributes this stage ships, and both are verified with
  `page.locator(sel).count()` against a running server before capture.
- The empty state is reached with a trip that has no categories rather than by hiding the list.
- Drag is exercised in the spec by keyboard — `@dnd-kit`'s keyboard sensor — which is also how the
  keyboard-reachability clause is proved rather than asserted.

**Console must be silent**, asserted through `watchConsole(page, route)` in every test of the block,
with nothing added to `TOLERATED_CONSOLE_WARNINGS`.

**No layout shift after paint**, measured with the init-script `PerformanceObserver` described in
`12-verification-protocol.md` §6: mark after `settle()`, then add a category, rename one and reorder
one, then assert the accumulated value after the mark is `0`. Gated on `supportedEntryTypes`, with
the WebKit skip stated rather than presented as a pass.

**The harness, quoted in full**, so the port, the session refresh and the clock pin are visible
here rather than inherited from a sentence elsewhere. `2026-08-20` is `BASELINE_DAY`, and
`capture.mjs` installs its header interceptor only when `PT_SERVER_TODAY` is set
(`scripts/ultrabuild/capture.mjs:168-169`), so an unset pin shoots a different day than the gate
compares.

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)

PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/budget-and-currencies.visual.spec.ts
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/budget-and-currencies.visual.spec.ts --update-snapshots -g '04-S2'

PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/$TRIP_ID/costs" \
  --out ".claude/ultrabuild/shots/04-budget-and-currencies/round-<n>/04-S2" \
  --label B --auth \
  --viewports 360x800,1280x900,2560x1440 --themes light,dark

PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/$TRIP_ID/costs" \
  --out ".claude/ultrabuild/shots/04-budget-and-currencies/round-<n>/04-S2" \
  --label B --auth --state rename \
  --viewports 360x800,1280x900,2560x1440 --themes light,dark \
  --click '[data-part="category-rename"]' --settle 800

PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/$TRIP_ID/costs" \
  --out ".claude/ultrabuild/shots/04-budget-and-currencies/round-<n>/04-S2" \
  --label B --auth --state delete-confirm \
  --viewports 360x800,1280x900,2560x1440 --themes light,dark \
  --click '[data-part="category-delete"]' --settle 800
```

Both declared states are one click from rest, so both are `capture.mjs`'s to take and both selectors
appear in the invocation above. Two frame sets this stage still owes are not: the empty state needs a
trip with no categories, and the keyboard reorder needs `@dnd-kit`'s keyboard sensor, which
`capture.mjs` cannot drive (`scripts/ultrabuild/capture.mjs:218-224` — one hover, one click, no key
presses). Both are reached in the spec and their frames copied into the same stage directory.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged: build succeeds; lint and typecheck are clean with
no suppressions; new logic has tests and `pnpm test` passes; verified in a real browser in light and
dark, desktop and mobile; nothing left behind — no TODO, no placeholder copy, no `console.log`, no
commented-out code; no file outside **Owned paths** touched.

The `docs/SPEC.md` §2 visual clauses, per surface:

- [ ] Spacing on the 4px grid from `--space-*`, no eyeballed one-off margins.
- [ ] Hover, focus-visible, active, disabled and loading on the add field, the grip, the pencil, the
      trash, the confirmation buttons and the reassign `Select`.
- [ ] Designed empty, skeleton and error states for the category list, each on `--color-surface-2`.
- [ ] Motion 150–260ms on `--ease-out-quint` or a sibling, transform and opacity only, drag feedback
      collapsed under `prefers-reduced-motion: reduce`.
- [ ] Light and dark parity, dark shadows re-declared, and every palette swatch AA in both themes.
- [ ] 360px → 2560px, where 360px puts the category header on its own line with the grip in the
      touch target rather than shrinking three controls into one row.
- [ ] Keyboard navigable end to end including reorder, sensible focus order, accessible names,
      WCAG 2.2 AA contrast in both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.
- [ ] `tabular-nums` on the per-category total and the expense count.

### Blockers

No package outside the `docs/SPEC.md` §3 pinned set is needed, and none is installed: `@dnd-kit` is
present and is already the reordering idiom in this repository.

One coordination finding, measured rather than anticipated, and already designed around: **`README.md`
lists six shared paths and `src/server/do/protocol.ts` is not among them, although it has exactly the
property that makes the other six shared** — one module, many stages, and two stages adding an entity
kind in parallel corrupt each other. `node scripts/ultrabuild/check-plan-collisions.mjs 04` finds
`07-S1` holding that module exclusively in this stage's own wave. This stage therefore declares no
entity kind and does not name the module; it mirrors under the existing `trip` kind instead, on the
precedent at `src/server/fns/costs.ts:478-480`. The durable fix is for `00-foundations.md` to govern
that module per wave the way it governs the schema; that is filed as a change to `README.md` and
`00-foundations.md`, neither of which this stage owns or edits, and it is **not** a blocker for this
stage, which now needs nothing from either.

**One precondition inherited from the harness, recorded here because `12-verification-protocol.md`
§7.2 requires the stage that baselines a trip tab to carry it rather than absorb it.** Every stage in
this file baselines `/trips/$tripId/costs`, which is a trip tab, and seven call sites still construct
their own `Intl.DateTimeFormat` with `month: 'short'` — two of them in `src/components/costs/data.ts`
— which workerd and WebKit abbreviate differently. Disposition: **report**. None of those files is in
this stage's **Owned paths**, so it repairs none of them; it widens no diff budget, which §5 of the
same file forbids outright; and it attributes a `mobile-safari` difference of that shape rather than
re-recording a baseline over it. §7.3 rides with it: nothing in the repository pins the browser
revisions behind these baselines, so a green comparison proves this stage changed nothing on this
machine and is not a claim about a second one.

## Stage 04-S3 — Edit the ledger where the reader is looking

### Stage id

`04-S3` · Wave 2 · effort **M**. Depends on `04-S2`, which supplies the category rows this ledger
groups by.

### Reference rows

- `MNY-02` partial → **done**. Today `-costs/expense-list.tsx` and `components/costs/expense-dialog.tsx`
  write through `createExpenseFn` / `updateExpenseFn` / `deleteExpenseFn`, and every edit is a dialog
  round trip. Correcting one figure in one row costs an open, a focus hunt, a save and a close. This
  stage adds editing in place on the row the reader is already looking at, an add-row pinned to the
  bottom of each day group, the per-person and per-day divisors the ledger is missing, and the three
  derived per-unit figures.
- **`MNY-01`'s one deferred behaviour lands here, and the row stays closed by `04-S2` rather than by
  this stage.** `04-S2` (wave 1) ships the trip's category entity and the grouping resolver but
  cannot write `expenses.cost_category_id`: the only two modules from which that column can be
  written — `src/server/repos/expenses.ts` and `src/server/fns/costs.ts` — are held exclusively in
  wave 1 by `04-S1`, and a second exclusive wave-1 claim would clobber it. This stage owns both, one
  wave later, so `createExpenseInput` and `updateExpenseInput` gain `costCategoryId` here (see
  **Server**), the two cross-tenant category cases are in this stage's isolation block, and from here
  on an expense carries the category its trip defined instead of only the fixed enum. This adds no
  module, no column and no wave to this stage; it is the same edit to the same two files, with one
  more field on the input schema.

**What the ledger is at HEAD, measured, because the shape of it decides the whole stage.**
`src/routes/_app/trips/$tripId/-costs/expense-list.tsx` is 209 lines and renders **no table**: it
imports `Avatar`, `Badge`, `IconButton`, `Spinner`, `Tooltip` and `TooltipProvider` from
`#/components/ui` and imports no `Table`. The list is a `<ul>` of `<li>` rows inside a `Panel` per
day group, grouped by `groupByDay` (`src/components/costs/data.ts:168`), and each row is a two-line
flex block: title and amount on the first line, payer, category, conversion, note and "yours" on the
second (`expense-list.tsx:125-171`). An earlier draft of this stage asserted the ledger "already
renders through the `Table` primitive" and built an inline-cell contract, a skeleton plan, a 360px
argument and a set of capture selectors on top of that assertion. It was false, and every one of
those four things is restated below against the list that actually exists. **This stage does not
build a table**; introducing one would be a redesign of a finished surface, not the edit-in-place
row `MNY-02` asks for, and it is not in scope here or anywhere else in this plan.

Two behaviours are stated precisely because they are easy to get subtly wrong:

- **The three per-unit figures are derived and never stored** — per person, per day, and per
  person-day. Persisting them guarantees they drift from the amount they were derived from.
  `budget_items` carries `persons` and `days` (`schema.ts:760-761`) and `expenses` does not; this
  stage asks for the same two nullable columns on `expenses` so a line item can carry its own.
- **The source amount is a first-class part of the row, not a footnote.** `formatConversion`
  (`src/lib/money.ts`) already renders it on the quiet line and the shipped expense write path
  already fills the columns it reads (`src/server/fns/costs.ts:283-301`);
  editing in place must keep the source amount and its rate editable as one pair, because changing
  an amount without its rate is what produces a row whose two figures disagree.

**One behaviour an earlier draft claimed and this stage does not attempt**, so that a later reader
does not restore it: a read-only title on a booking-derived expense. Measured, `expenses` has **no
reservation reference at all** — its foreign keys are `day_id`, `place_id` and `budget_item_id`
(`src/server/db/schema.ts:785-787`), and `grep -n reservation src/server/db/schema.ts` returns
nothing inside that table. There is nothing to render read-only until a booking can own an expense,
and giving it one is `03-reservations-and-transport.md`'s column to add, not this stage's.

Sourced from `wiki: Budget-Tracking`.

### Owned paths

- `src/server/repos/expenses.ts` — edit. The two new columns on the writers' inputs and the partial
  patch.
- `src/server/fns/costs.ts` — edit. `updateExpenseFn` takes a patch; `loadCosts` returns the
  divisors.
- `src/routes/_app/trips/$tripId/-costs/expense-list.tsx` — edit. The row becomes editable in place
  and gains the add-row.
- `src/routes/_app/trips/$tripId/-costs/actions.ts` — edit. The optimistic patch op.
- `src/components/costs/expense-dialog.tsx` — edit. The divisors join the full form.
- `src/components/costs/data.ts` — edit. The derivation helpers and the patch merge.
- `src/components/costs/__tests__/data.test.ts` — edit.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. One new `describe` block.
- `e2e/budget-and-currencies.visual.spec.ts` — append. This stage's own `describe` block.
- `e2e/__screenshots__/budget-and-currencies.visual.spec.ts/` — append. The baseline directory
  `playwright.config.ts:49-50` derives from that spec's file name, so
  `--update-snapshots -g '04-S3'` writes this stage's own frames into it whether the stage
  names it or not. It is named because writing into a path a stage did not declare fails
  `docs/SPEC.md` §7 item 6. `append`, not `edit`: every frame name begins with the stage id, so
  this stage adds its own PNGs and overwrites nobody else's.

Disjoint from the other two wave-2 stages, checked with
`node scripts/ultrabuild/check-plan-collisions.mjs 04` rather than by reading them: `04-S4` owns
`stat-tiles.tsx`, `rail.tsx`, its two new chart modules and `src/components/costs/index.ts`; `04-S5`
owns its own new repository, server-function and dialog modules plus `costs-toolbar.tsx` and
`-costs/screen.tsx`. Two paths here are also held by an **earlier-wave** stage in another plan and
are named with their sibling ids: `src/server/repos/expenses.ts` by `00-S1` (wave 0) and
`src/server/fns/costs.ts` by `00-S2` (wave 0). Within this plan both are also held by `04-S1`
(wave 1), which closes first.

### Data and migration

Two columns, additive, filed to `00-foundations.md` — specifically to the schema stage that **closes
before wave 2 opens**, not to one that runs alongside this stage, because a column supplied by a
same-wave stage would not have landed when this one starts. `00-foundations.md` mints the id and
holds `src/server/db/schema.ts` and `drizzle/`; this stage names neither.

| Table      | Column    | Type      | Notes                                                         |
| ---------- | --------- | --------- | ------------------------------------------------------------- |
| `expenses` | `persons` | `integer` | Nullable, `nonNegativeCheck`, mirrors `budget_items.persons`. |
| `expenses` | `days`    | `integer` | Nullable, `nonNegativeCheck`, mirrors `budget_items.days`.    |

**Backfill: none.** `NULL` means "not stated for this line", and a per-unit figure derived from a
`NULL` divisor is not rendered as zero, not rendered as infinity, and not rendered at all — the
figure's slot on the row's quiet line shows an em-dash, and the row's own `Tooltip` explains the rule
once rather than a column header, because this ledger has no header row. Existing rows keep `NULL`
and the previous Worker, which reads neither column, keeps working.

No new table. Money stays integer minor units plus a `text(3)` ISO-4217 currency; the derived
per-unit figures are computed at render time from `amount_minor` and are never written anywhere.

No foreign key is added and none is needed. `expenses.budget_item_id` (`schema.ts:787`) is the only
link this stage reads; it already exists and is already re-resolved in the caller's scope on write
(`src/server/repos/expenses.ts:301`). A link from a booking to an expense does not exist at HEAD and
is not invented here — see **Reference rows**.

### Server (repo, server function, Zod)

**Repository — `src/server/repos/expenses.ts` (edit).** `createExpenseInput` and `updateExpenseInput`
gain `persons` and `days` as nullable non-negative integers with the same `.max(1000)` bound
`budget_items` already uses, and `costCategoryId` as a nullable id re-resolved through the category
repository inside the caller's scope. SQL stays in this module — `src/server/repos/expenses.ts` — and every query keeps starting
from `tenantFilter()`, so each statement carries `organization_id = ?` before any other predicate;
`expenses_org_trip_idx` already leads with `organization_id`, so the two new columns add no index and
change no access path.

**Server function — `src/server/fns/costs.ts` (edit).** `updateExpenseFn` accepts a **partial** patch
so one committed field is one small write rather than a whole-row replace; `loadCosts` returns
`persons`, `days` and the budget-item link per row. Both continue to mirror to the trip room under
the existing `expense` kind — no new patch kind, so `src/server/do/protocol.ts` is not an owned path
of this stage either.

**Zod (v4).** `z.strictObject()` with `error`; a patch shape where every field is optional and at
least one must be present, refined rather than assumed; `z.iso.date()` on `spentOn`. A patch that
arrives with only an id is rejected as a malformed request rather than executed as a no-op write.

**Authorisation** is decided in the handler: `appScope()`, `requireTrip()`, then the repository. A
per-field write is the same endpoint with a smaller body, and it re-authorises exactly like the
dialog write it replaces.

### UI (route, components)

**Route.** None added, none edited. No `pnpm generate-routes`.

**Components.** Reused, all of them already imported by this screen or already shipped in
`src/components/ui`: `Input`, `Select`, `DatePicker`, `IconButton`, `Tooltip`, `TooltipProvider`,
`Badge`, `Avatar`, `Spinner`, `Kbd` (the editor's shortcut hint) and `Alert`. **`Table` is not
used and is not introduced**: the ledger is the day-grouped `<ul>` measured above, and editing
happens inside the row that is already there. New product component: a route-local field editor
beside the row in `expense-list.tsx`, small enough to live in that file rather than earning a module
of its own.

**Interaction contract, stated because "editing in place" hides a dozen decisions, and stated
against a row rather than a grid.** A row has four editable fields — title, amount, payer and date —
plus the two divisors on its quiet line. A field enters edit on click, or on `Enter` when it is
focused; `Escape` reverts it and restores focus to the field; `Enter` commits and moves to the next
editable field of the same row; `Tab` commits and moves; blur commits. The row's tab order is its
reading order, and it is unchanged from the resting row, so a keyboard reader who knows the list
already knows the editor. Nothing auto-saves on a keystroke — one write per committed field — and the
row keeps the `aria-busy` and dimmed treatment it already applies while a write is in flight
(`expense-list.tsx:110-122`). A field that enters edit does not change the row's height: the editor
is sized to the text it replaces, which is what keeps the layout-shift assertion below at zero.

**States.**

- _Empty_ — the existing screen-level empty state (`-costs/screen.tsx`) is kept and not re-designed.
  The add-row is pinned to the bottom of each day group, so a day with one expense still offers one
  editable line under it, on `--color-surface-2`.
- _Skeleton_ — **unchanged, deliberately, and the reason is a measurement.** The ledger's loading
  state is `CostsSkeleton` (`-costs/skeleton.tsx`, owned by `04-S2` in wave 1) rendering
  `RowsSkeleton` from `src/routes/_app/-ui/scaffold.tsx`, which no stage in this plan owns. This
  stage adds nothing to either, because it adds no line to the row: the divisors and the three
  derived figures sit on the quiet line that already exists, and the row's height is the same before
  and after. The frame set proves the shape still fits; if it does not, that is a filing to `04-S2`'s
  file and a finding, not an unowned edit.
- _Error_ — a rejected field reverts, marks itself with `--color-danger`, and shows the reason in an
  inline `Alert` under the row on `--color-surface-2`, with "try again" re-issuing the same write.
- _Loading_ — the committing field shows a subdued state and stays readable; it never collapses to a
  spinner, and the row's existing `Spinner` in its trailing action group is the one moving-parts
  indicator.

**Tokens.** None missing; spacing on the 4px grid from `--space-*`, no hex, no one-off margin.
`font-variant-numeric: tabular-nums` on the amount, the source amount, the persons and days counts
and all three derived per-unit figures — a derived figure that jitters as the reader types is exactly
the failure the token exists to prevent.

### Quota

Creates no new countable row: an expense is a row this screen already creates, and expense volume is
metered upstream through `trips`. No metric is added to `resolveLimits()` or `PLAN_QUOTAS`, and no
case is added to `src/server/billing/__tests__/limits.test.ts`.

### Tenant isolation test

Appended as its own `describe` block. In A's scope: patch a single field of B's expense by id
(`NotFoundError`); patch B's expense to point at one of A's categories (`NotFoundError`); patch one
of A's expenses to point at one of B's categories (`NotFoundError`); read and delete B's expenses by
id (`NotFoundError`). B's rows are compared before and after. Functions covered: `createExpense`,
`updateExpense`, `deleteExpense` and `getExpenseWithShares` in `src/server/repos/expenses.ts`.

### Verification

**Command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests.** `src/components/costs/__tests__/data.test.ts` (edit) — the three derived figures are
computed from the amount and the divisors and are absent, not zero, when a divisor is `NULL`; a
per-unit figure of a converted expense is derived from the accounting amount, not from the source
amount; an expense whose `cost_category_id` is `NULL` still resolves to its legacy enum label through
the resolver `04-S2` ships in `-costs/category-model.ts`, which this stage imports rather than
re-implements and which is the ledger's guard against a row losing its label; and a partial
patch merges through `applyOps` (`src/components/costs/data.ts:266`) without clearing the fields it
omits.

**Browser evidence.** `describe` block `04-S3 — editing the ledger in place`, shared helpers only.

- Route: `/trips/$tripId/costs`. Frame set: light and dark at **360px, 1280px and 2560px** at rest.
- **Declared non-resting states**: the amount field of a row in edit, reached by `--click` on
  `[data-part="expense-field-amount"]`, framed as `--state field-edit`; and the add-row of a day
  group focused with its first field open, reached by `--click` on `[data-part="expense-add-row"]`,
  framed as `--state add-row`. Both are stable `data-part` attributes this stage ships onto the
  existing row markup, and both are verified with `page.locator(sel).count()` returning 1 against a
  running server before capture — reading the JSX and believing it is not a verification.
- At 360px the row is already a designed two-line stack rather than a squeezed wide line, which is
  the shape at HEAD and not something this stage invents; what the frame has to prove is that the
  editor **preserves** it — one field open at a time, the field sized to the text it replaced, and no
  horizontal scroller introduced.

**Console must be silent**, asserted through `watchConsole`. **No layout shift after paint**,
measured with the init-script observer, marked after `settle()`, then a field opened, edited and
committed, asserted `0` after the mark, gated on `supportedEntryTypes` with the WebKit skip stated.

**The harness, quoted in full**, so the port, the session refresh and the clock pin are visible
here rather than inherited from a sentence elsewhere. `2026-08-20` is `BASELINE_DAY`, and
`capture.mjs` installs its header interceptor only when `PT_SERVER_TODAY` is set
(`scripts/ultrabuild/capture.mjs:168-169`), so an unset pin shoots a different day than the gate
compares.

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)

PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/budget-and-currencies.visual.spec.ts
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/budget-and-currencies.visual.spec.ts --update-snapshots -g '04-S3'

PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/$TRIP_ID/costs" \
  --out ".claude/ultrabuild/shots/04-budget-and-currencies/round-<n>/04-S3" \
  --label B --auth \
  --viewports 360x800,1280x900,2560x1440 --themes light,dark

PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/$TRIP_ID/costs" \
  --out ".claude/ultrabuild/shots/04-budget-and-currencies/round-<n>/04-S3" \
  --label B --auth --state field-edit \
  --viewports 360x800,1280x900,2560x1440 --themes light,dark \
  --click '[data-part="expense-field-amount"]' --settle 800

PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/$TRIP_ID/costs" \
  --out ".claude/ultrabuild/shots/04-budget-and-currencies/round-<n>/04-S3" \
  --label B --auth --state add-row \
  --viewports 360x800,1280x900,2560x1440 --themes light,dark \
  --click '[data-part="expense-add-row"]' --settle 800
```

Both declared states are one click from rest and are taken by `capture.mjs` with the selectors above.
The keyboard contract — `Enter` commits, `Escape` reverts, `Tab` moves to the next field — is proved
in the spec rather than in a frame, because a screenshot cannot show which key produced it.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged: build succeeds; lint and typecheck clean with no
suppressions; new logic tested and `pnpm test` passing; verified in a real browser in light and dark,
desktop and mobile; nothing left behind; no file outside **Owned paths** touched.

- [ ] Spacing on the 4px grid from `--space-*`, no eyeballed one-off margins.
- [ ] Hover, focus-visible, active, disabled and loading on every field editor, the add-row and every
      control in it.
- [ ] Designed empty, skeleton and error states for the ledger, each on `--color-surface-2` — the
      skeleton being the existing one, confirmed to still fit rather than assumed to.
- [ ] Motion 150–260ms on `--ease-out-quint` or a sibling, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured.
- [ ] Light and dark parity with dark shadows re-declared.
- [ ] 360px → 2560px, where 360px keeps the row's designed two-line stack and the editor never
      introduces a horizontal scroller.
- [ ] Keyboard navigable end to end — `Enter`, `Escape` and `Tab` all specified above — with sensible
      focus order, accessible names and WCAG 2.2 AA contrast in both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.
- [ ] `tabular-nums` on the amount, both divisors and all three derived figures.

### Blockers

**Nothing stops this stage.** No package outside the pinned set, no binding, no third-party service.
`MNY-01`, the row it depends on, is closed by `04-S2` in wave 1, which lands before wave 2 opens —
every part of it except the one behaviour `04-S2` defers to here, the write that files an expense
into a trip-defined category, which this stage lands because it is the first stage that can own the
expense writers. That is stated in `04-S2`'s **Reference rows** and carried above in this stage's
**Reference rows**, **Server**, **Tenant isolation test** and **Verification** sections.

**One precondition inherited from the harness, recorded here because `12-verification-protocol.md`
§7.2 requires the stage that baselines a trip tab to carry it rather than absorb it.** Every stage in
this file baselines `/trips/$tripId/costs`, which is a trip tab, and seven call sites still construct
their own `Intl.DateTimeFormat` with `month: 'short'` — two of them in `src/components/costs/data.ts`
— which workerd and WebKit abbreviate differently. Disposition: **report**. None of those files is in
this stage's **Owned paths**, so it repairs none of them; it widens no diff budget, which §5 of the
same file forbids outright; and it attributes a `mobile-safari` difference of that shape rather than
re-recording a baseline over it. §7.3 rides with it: nothing in the repository pins the browser
revisions behind these baselines, so a green comparison proves this stage changed nothing on this
machine and is not a claim about a second one.

## Stage 04-S4 — Show where the money went, drawn by hand

### Stage id

`04-S4` · Wave 2 · effort **M**. Depends on `04-S2` for the category rows and their palette index.

### Reference rows

- `MNY-04` partial → **done**. Today `-costs/stat-tiles.tsx` gives four figures from real aggregates
  and `-costs/rail.tsx` gives a category list with proportional bars. Missing: a category donut, a
  per-member proportional breakdown on the total card, and the hover link that ties a legend row to
  its segment in both directions. This stage adds all three.

Sourced from `wiki: Budget-Tracking`.

### Owned paths

- `src/components/costs/category-donut.tsx` — new.
- `src/components/costs/member-bar.tsx` — new.
- `src/components/costs/__tests__/chart-geometry.test.ts` — new.
- `src/components/costs/index.ts` — edit. The module barrel every consumer of that directory imports
  through; this stage is its **only** claimant in wave 2, which is what lets the two new modules be
  reached the way the existing six are.
- `src/routes/_app/trips/$tripId/-costs/rail.tsx` — edit.
- `src/routes/_app/trips/$tripId/-costs/stat-tiles.tsx` — edit.
- `e2e/budget-and-currencies.visual.spec.ts` — append. This stage's own `describe` block.
- `e2e/__screenshots__/budget-and-currencies.visual.spec.ts/` — append. The baseline directory
  `playwright.config.ts:49-50` derives from that spec's file name, so
  `--update-snapshots -g '04-S4'` writes this stage's own frames into it whether the stage
  names it or not. It is named because writing into a path a stage did not declare fails
  `docs/SPEC.md` §7 item 6. `append`, not `edit`: every frame name begins with the stage id, so
  this stage adds its own PNGs and overwrites nobody else's.

`src/server/repos/__tests__/tenant-isolation.test.ts` is **not** named: this stage writes no row and
adds no repository function, so it has no isolation case to add. See **Tenant isolation test** below
for why that is a statement rather than an omission.

Because this stage holds the barrel for the wave, **no other wave-2 stage may add a module to
`src/components/costs/`** — a new file there is unreachable without a barrel line, and a second stage
editing the barrel in parallel is the collision the disjointness rule exists to prevent. `04-S5` was
drafted with a new module in that directory and no claim on the barrel; it now ships its dialog
route-locally instead, and says so under its own **Owned paths**. Nothing in this plan is left
needing a barrel line this stage does not write.

### Data and migration

**No schema change, and none implied.** Every figure this stage draws already exists:
`getTripSpendSummary` returns per-category planned and spent totals, `getMemberBalances` returns the
per-member split, and `listDailySpend` returns the daily series — all in
`src/server/repos/expenses.ts`, all tenant-scoped, all already in the `loadCosts` payload.

Money remains integer minor units paired with a `text(3)` ISO-4217 currency for every figure this
stage renders; percentages are derived at render time from those integers and are never stored. A
segment's angle is computed from the minor-unit integer, never from a formatted string.

### Server (repo, server function, Zod)

**No repository change, no new server function, no new Zod schema.** This stage is a read of a
payload that already arrives. Stating that explicitly matters: a charting stage that quietly adds an
aggregate endpoint is how a second, disagreeing source of truth for "total spend" gets created.

The one server-side rule it inherits and must not break: totals are aggregated in the trip's
accounting currency and converted for the reader exactly once, in `loadCosts`, before they reach the
chart. The donut never converts anything itself.

### UI (route, components)

**Route.** None added, none edited. No `pnpm generate-routes`.

**Everything is drawn on existing `src/components/ui` primitives and hand-written geometry. No
charting package may be added — `docs/SPEC.md` §3 freezes the dependency set, `package.json` and
`pnpm-lock.yaml` are not edited by this stage or any other, and a chart is not a reason to break a
freeze.** `11-boundaries-and-blockers.md` (`11-S2`) already looked at this row and recorded it as
**not blocked**, on the grounds that the geometry is SVG arcs over existing tokens and that
`src/components/ui/sparkline.tsx` is the standing precedent for exactly that.

| Widget                      | Built on                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Category donut              | Hand-written SVG arc geometry in `category-donut.tsx`, coloured from the `--color-data-*` palette `04-S2` filed, framed by `Card` and `SectionLabel`, legend rows built from `Badge` and `Tooltip`. `ProgressRing` (`src/components/ui/progress.tsx:150`) is read for its `stroke-dasharray` technique and is **not** duplicated — it is single-valued by design, and a multi-segment ring is a different component rather than a variant of it. |
| Per-member proportional bar | `member-bar.tsx`, a flex track of token-coloured segments with `AvatarStack` for the faces and `Progress` (`src/components/ui/progress.tsx:42`) reused unchanged wherever a single-valued bar is what the row actually needs — a planned-versus-spent row, for instance.                                                                                                                                                                         |
| Spend sparkline             | `Sparkline` (`src/components/ui/sparkline.tsx`) reused as-is on the inverse total tile, fed by `dailySeries` which `src/components/costs/data.ts` already computes. No second trend curve is written.                                                                                                                                                                                                                                            |

**What would be blocked, named so nobody re-litigates it.** Anything needing a real charting grammar
— a zoomable time axis, stacked area series with brushing, an interactive multi-series legend with
scales — is **BLOCKED** and is not attempted here. Its disposition is recorded in
`11-boundaries-and-blockers.md`: stop and report, never install. This stage ships three figures a
reader can take in at a glance and no chart that would need an axis library to be honest.

**Accessibility, which is where hand-drawn charts usually fail.** The donut is not a picture of a
table the reader cannot reach. Each segment is a focusable element with an accessible name reading
"Food, 32 percent, 412 euros"; the legend is a real list whose rows are keyboard-focusable and linked
to their segment by `aria-controls`; and the whole widget is preceded by a visually hidden table of
the same figures, so a screen reader gets the data rather than a shape. Colour is never the only
channel: every legend row carries its own percentage and amount as text.

**States.**

- _Empty_ — a trip with no spend renders an `EmptyState` inside the card on `--color-surface-2`,
  with the line "Nothing logged yet" and a link to add the first expense, rather than a donut of one
  grey ring which reads as a bug.
- _Skeleton_ — a circle `Skeleton` at the donut's exact diameter plus three legend-row skeletons, so
  the card does not resize when the payload lands. Added to `-costs/skeleton.tsx`? **No** — that file
  belongs to `04-S2` in wave 1; this stage's skeleton lives inside `category-donut.tsx` behind its own
  `pending` prop, which is also how the spec reaches the loading frame.
- _Error_ — the card renders an `Alert` on `--color-surface-2` naming what failed with a retry that
  re-runs the route loader; the rest of the screen keeps working, because one failed widget must not
  take the ledger down with it.
- _Loading_ — the pending prop, as above.

**Motion.** Segments sweep in over 220ms on `--ease-out-quint`, staggered 24ms and capped at eight
segments; the hover link is a 150ms opacity and stroke-width change, transform and opacity only. All
of it collapses to a static render under `prefers-reduced-motion: reduce` — an animated ring is the
single most obvious thing to get wrong here.

**Tokens.** The `--color-data-*` palette filed by `04-S2` is the only requirement, and it is filed
there rather than twice. No hex, no one-off radius, no shadow written by hand: the card is
`--radius-xl` with `--shadow-card` and a hairline `--color-edge-faint` border, and dark re-declares
its own shadow rather than reusing the light one.

Every figure this stage renders — every amount, every percentage in the legend, every per-member
figure on the bar — carries `font-variant-numeric: tabular-nums`.

### Quota

**Creates no countable row.** This stage is read-only: it adds no table, no repository function and
no write path, so it consumes no metric, adds nothing to `resolveLimits()` or `PLAN_QUOTAS`, and adds
no case to `src/server/billing/__tests__/limits.test.ts`.

### Tenant isolation test

**No case is added to `src/server/repos/__tests__/tenant-isolation.test.ts`, and the reason is that
there is nothing to isolate.** This stage writes no row, adds no repository function and issues no
query; every figure it draws arrives through `loadCosts`, whose aggregates are already
`organization_id`-scoped in `src/server/repos/expenses.ts` through `tenantFilter()` and are already
covered by the existing cases. The rule that a stage adding a repository function without an
isolation case is not done still binds — it simply does not apply to a stage that adds none.

One thing this stage must not do, stated so it cannot happen by accident: no component under
`src/components/**` imports from `src/server/**`, per `docs/SPEC.md` §6. The donut takes plain props
and knows nothing about a tenant, a scope or a database.

### Verification

**Command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests.** `src/components/costs/__tests__/chart-geometry.test.ts` (new) — the arc path for a
list of category totals sweeps exactly 360 degrees with no gap and no overlap; a single category
produces a full ring rather than a degenerate path; a zero total produces the empty state rather than
a division by zero; a category worth less than half a degree still receives a minimum visible sweep
and the remaining segments absorb the difference so the ring still closes; percentages in the legend
sum to exactly 100 after rounding, with the residue given to the largest segment; segment order and
palette index are stable across re-renders, so a colour never changes because a total did.

**Browser evidence.** `describe` block `04-S4 — costs summary widgets`, shared helpers only.

- Route: `/trips/$tripId/costs`. Frame set: light and dark at **360px, 1280px and 2560px** at rest.
- **Declared non-resting state**, because the hover link is the entire point of the row and a
  resting frame is not evidence about it: a legend row hovered with its segment highlighted, reached
  by `--hover` on `[data-part="donut-legend-row"]`, framed as `--state legend-hover`; and the same
  link driven from the other direction by focusing a segment with the keyboard, framed as
  `segment-focus`. The first is one hover from rest and is `capture.mjs`'s; the second is the spec's,
  because `:focus-visible` does not appear on a mouse click and `capture.mjs` drives no keys — the
  harness block below states it. Both selectors are stable `data-part` attributes this stage ships and
  are verified with `page.locator(sel).count()` against a running server before capture.
- The loading frame is reached through the component's own `pending` prop rather than by racing the
  network.
- At 2560px the rail must not stretch the donut into a decorative void; the frame is what proves it.

**Console must be silent**, asserted through `watchConsole` in every test of the block. **No layout
shift after paint**: init-script observer, mark after `settle()`, then hover a legend row and resize,
assert `0` after the mark, gated on `supportedEntryTypes` with the WebKit skip stated.

**The harness, quoted in full**, so the port, the session refresh and the clock pin are visible
here rather than inherited from a sentence elsewhere. `2026-08-20` is `BASELINE_DAY`, and
`capture.mjs` installs its header interceptor only when `PT_SERVER_TODAY` is set
(`scripts/ultrabuild/capture.mjs:168-169`), so an unset pin shoots a different day than the gate
compares.

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)

PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/budget-and-currencies.visual.spec.ts
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/budget-and-currencies.visual.spec.ts --update-snapshots -g '04-S4'

PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/$TRIP_ID/costs" \
  --out ".claude/ultrabuild/shots/04-budget-and-currencies/round-<n>/04-S4" \
  --label B --auth \
  --viewports 360x800,1280x900,2560x1440 --themes light,dark

PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/$TRIP_ID/costs" \
  --out ".claude/ultrabuild/shots/04-budget-and-currencies/round-<n>/04-S4" \
  --label B --auth --state legend-hover \
  --viewports 360x800,1280x900,2560x1440 --themes light,dark \
  --hover '[data-part="donut-legend-row"]' --settle 800
```

`legend-hover` is one hover from rest and is `capture.mjs`'s. `segment-focus` is not, and the reason
is a property of the platform rather than of the script: `:focus-visible` does not appear on a mouse
click, so a clicked frame would photograph the wrong ring. It is reached in the spec by tabbing to the
segment and its frames are written with `page.screenshot({ path: testInfo.outputPath(name) })` into
`test-results/` and copied across. The loading set is reached the same way, through the component's own
`pending` prop rather than by racing the network.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged: build succeeds; lint and typecheck clean with no
suppressions; new logic tested and `pnpm test` passing; verified in a real browser in light and dark,
desktop and mobile; nothing left behind; no file outside **Owned paths** touched.

- [ ] Spacing on the 4px grid from `--space-*`, no eyeballed one-off margins.
- [ ] Hover, focus-visible, active, disabled and loading on every legend row and every segment.
- [ ] Designed empty, skeleton and error states for the donut and the member bar, each on
      `--color-surface-2`.
- [ ] Motion 150–260ms on `--ease-out-quint` or a sibling, transform and opacity only, stagger capped
      at eight, `prefers-reduced-motion: reduce` honoured.
- [ ] Light and dark parity with dark shadows re-declared, and every palette swatch AA in both.
- [ ] 360px → 2560px, where the donut and its legend stack on small and neither stretches on wide.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes, and the data reachable as text rather than only as colour.
- [ ] Zero console errors or warnings, and zero layout shift after paint.
- [ ] `tabular-nums` on every amount and percentage.

### Blockers

**Nothing stops this stage, and one thing is deliberately not attempted.** No charting package is
added — the freeze in `docs/SPEC.md` §3 covers `package.json` and `pnpm-lock.yaml` absolutely,
`11-S2` already recorded this row as buildable without one, and anything that would genuinely need a
charting grammar is BLOCKED and recorded in `11-boundaries-and-blockers.md` rather than built
around.

**One precondition inherited from the harness, recorded here because `12-verification-protocol.md`
§7.2 requires the stage that baselines a trip tab to carry it rather than absorb it.** Every stage in
this file baselines `/trips/$tripId/costs`, which is a trip tab, and seven call sites still construct
their own `Intl.DateTimeFormat` with `month: 'short'` — two of them in `src/components/costs/data.ts`
— which workerd and WebKit abbreviate differently. Disposition: **report**. None of those files is in
this stage's **Owned paths**, so it repairs none of them; it widens no diff budget, which §5 of the
same file forbids outright; and it attributes a `mobile-safari` difference of that shape rather than
re-recording a baseline over it. §7.3 rides with it: nothing in the repository pins the browser
revisions behind these baselines, so a green comparison proves this stage changed nothing on this
machine and is not a claim about a second one.

## Stage 04-S5 — Change a trip's accounting currency without moving any money

### Stage id

`04-S5` · Wave 2 · effort **M**. Depends on `04-S1` for `convertMinor()`, for the `resolveRate` seam
it re-anchors through, and for the `settlements` source triple it pins. It does **not**
depend on `TRP-03` (`01-trips-core.md`, wave 1): that stage may call this one's server function from
the trip edit surface, but this stage ships its own entry point and closes without it.

### Reference rows

- `MNY-06` partial → **done**. `trips.currency` exists, defaults to `EUR` and is set at creation in
  `-ui/new-trip-dialog.tsx`. The trip edit sheet could also change it afterwards, and nothing would
  re-base the trip's data when it did; since #838 `updateTrip` applies a different currency only to
  a trip with nothing priced in it and refuses it, whole save included, on any other. This stage
  makes the change safe for a trip that has money in it, which is the whole of the work: a currency
  change is a re-basing, not a relabel.

Five rules, each of which prevents a specific silent corruption:

1. **A row that inherited the trip's currency is pinned into its own source columns before the base
   moves.** `original_amount_minor` takes the figure the reader typed, `original_currency` takes the
   old code. Otherwise a figure typed under the old base is reinterpreted as the new one and the
   number lies.
2. **An amount and its currency code move in the same statement.** A row is never written with
   `amount_minor` in the new base and `currency` still naming the old one. This rule is stated
   because an earlier draft of this stage broke it: it pinned `currency = old`, recomputed
   `amount_minor` into the new base, and never wrote the new code — leaving every expense on the trip
   labelled with a currency it was no longer denominated in. That is a silent money-mislabelling in a
   stage whose title promises not to move any money, and the batch below is written so it cannot
   recur.
3. **Every frozen rate is re-anchored**, because a frozen rate is stored relative to the accounting
   currency, and leaving it anchored to a base that no longer exists is worse than having no rate.
4. **Every derived figure denominated in the base is recomputed with it.** `expense_shares.share_minor`
   is in the accounting currency (`schema.ts:830`) and is not recoverable from a converted total,
   so it is recomputed from each row's stored `weight` and must still sum exactly to the new
   `amount_minor`. A base change that left the shares behind would re-open a settled trip.
5. **No amount the reader typed is ever rewritten.** Every row keeps its own figure in its own
   currency in its source columns; only the base the balances are expressed in changes.

Sourced from `wiki: Currencies`.

### Owned paths

- `src/server/repos/trip-currency.ts` — new. Every statement of the re-basing.
- `src/server/repos/__tests__/trip-currency.test.ts` — new.
- `src/server/fns/trip-currency.ts` — new. The preview and the commit.
- `src/routes/_app/trips/$tripId/-costs/currency-rebase-dialog.tsx` — new. Route-local, beside the
  screen that opens it.
- `src/components/costs/costs-toolbar.tsx` — edit. The entry point.
- `src/routes/_app/trips/$tripId/-costs/screen.tsx` — edit. Mounts the dialog and holds its state.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. One new `describe` block.
- `e2e/budget-and-currencies.visual.spec.ts` — append. This stage's own `describe` block.
- `e2e/__screenshots__/budget-and-currencies.visual.spec.ts/` — append. The baseline directory
  `playwright.config.ts:49-50` derives from that spec's file name, so
  `--update-snapshots -g '04-S5'` writes this stage's own frames into it whether the stage
  names it or not. It is named because writing into a path a stage did not declare fails
  `docs/SPEC.md` §7 item 6. `append`, not `edit`: every frame name begins with the stage id, so
  this stage adds its own PNGs and overwrites nobody else's.

**Why the dialog is route-local rather than a module in `src/components/costs/`.** An earlier draft
put it there and claimed no share of `src/components/costs/index.ts`, which is the barrel every
consumer of that directory imports through — so the module would have been unreachable — while
`04-S4`, in this same wave, does claim that barrel. Two wave-2 stages needing one file is precisely
the collision the disjointness rule exists to stop. The dialog has exactly **one** caller, this
screen, so the directory was the wrong home anyway: it lives at
`src/routes/_app/trips/$tripId/-costs/currency-rebase-dialog.tsx`, is imported relatively by
`-costs/screen.tsx`, and needs no barrel line from anyone.

**The trip edit dialog is not claimed either.** `TRP-03` owns that surface and this stage does not
know its filename; the re-basing is exposed as one server function that `TRP-03` may call, and this
stage ships its own entry point in the money toolbar where a currency change is most likely to be
wanted. That contract — one server function, callable from a second surface this stage does not
own — is stated here so `01-trips-core.md` can rely on it without either stage editing the other's
file. It is the **function** that is shared, never the component.

Disjoint from the other wave-2 stages, checked with
`node scripts/ultrabuild/check-plan-collisions.mjs 04`: `04-S3` owns `expense-list.tsx`,
`actions.ts`, `expense-dialog.tsx` and `data.ts`; `04-S4` owns `rail.tsx`, `stat-tiles.tsx`, its two
chart modules and `src/components/costs/index.ts`. No path appears twice in wave 2.

### Data and migration

**One filing, and everything else already exists.** `trips.currency`, `expenses.amount_minor`,
`expenses.currency`, `expenses.original_amount_minor`, `expenses.original_currency`,
`expenses.exchange_rate`, `expense_shares.share_minor`, `expense_shares.weight`, `places.price_minor`
and `places.currency` are all on disk; the settlement triple lands with `00-S1` in wave 0.

The filing is the same three columns on **`budget_items`**, which today carries
`planned_amount_minor` and `currency` (`schema.ts:758-759`) and no source columns at all. Without
them a planned figure cannot be re-based under rule 5: there is nowhere to keep what the reader
typed, so the choice would be between rewriting their number and leaving a plan denominated in a base
the trip no longer uses. It is filed to `00-foundations.md` — to the schema stage of the wave that
**closes before wave 2 opens**, for the reason `04-S3` states — and this stage names neither
`src/server/db/schema.ts` nor `drizzle/`.

| Table          | Column                  | Type      | Notes                                                      |
| -------------- | ----------------------- | --------- | ---------------------------------------------------------- |
| `budget_items` | `original_amount_minor` | `integer` | Nullable, no default, no CHECK.                            |
| `budget_items` | `original_currency`     | `text(3)` | Nullable, same `currency('original_currency')` helper.     |
| `budget_items` | `exchange_rate`         | `real`    | Nullable. Major-per-major, `1 original = rate` accounting. |

Additive, nullable, no CHECK and no index — the same three decisions `00-S1` argues for the
settlement triple, for the same reasons: a CHECK change is a full table rebuild on SQLite, the
non-negative guard lives in the repository's Zod input instead, and none of the three columns is ever
a filter. The previous Worker reads none of them and keeps working after a rollback.

**Backfill: none, and the reading of an un-backfilled row is stated rather than inferred.** Every
budget item written before the migration is by construction denominated in its trip's accounting
currency, so the triple stays `NULL` and `NULL` means exactly one thing here, as it does on
`expenses` and `settlements`: _no conversion happened, and the implied rate is 1_. Only a re-basing
ever fills these columns; an ordinary budget-item write is typed in the trip's own currency and
leaves them null, which is why no other stage in this plan needs to change a budget-item writer.

Money stays integer minor units plus a `text(3)` ISO-4217 code throughout; a re-basing changes codes
and rates, never an amount a reader typed.

**A data migration is not a schema migration, and this one runs in a server function rather than in
`drizzle/`.** It is per-trip, initiated by a reader, and scoped to one tenant, so it cannot be a
deployment-time SQL file. It runs as a single `db.batch()`, which on D1 is a real transaction —
statements execute in sequence and an error rolls the whole sequence back — so a half-re-based trip
is not a reachable state.

The batch, in order, for a change from `old` to `new`. `k` is the single old-to-new rate, resolved
**once** before the batch opens through `src/server/repos/rates.ts` — one `k` for the whole batch,
never one lookup per row, because two rows re-anchored at two different rates would not net to zero
afterwards.

_Pin first. Nothing is converted until every row holds its own source figure._

1. `expenses`: for every row of the trip with `original_currency IS NULL`, set
   `original_amount_minor = amount_minor`, `original_currency = old`, `exchange_rate = 1`. Rows that
   already carry a source triple — a foreign receipt entered through the shipped expense dialog — are
   left alone; their
   source is already the truth.
2. `settlements`: the identical pinning, over the triple `00-S1` adds.
3. `budget_items`: the identical pinning, over the triple filed above.
4. `places`: `SET currency = old WHERE price_minor IS NOT NULL AND currency IS NULL`. A place price
   is a reference figure rather than an accounting one — it is never netted into a balance — so
   pinning it is the whole treatment and it is deliberately **not** converted. Its own row now says
   which currency it is in, which is what it was missing.

_Then convert. Amount, rate and code move together, in one statement per table._

5. `expenses`, one `UPDATE` per row writing three columns at once:
   `amount_minor = convert(original_amount_minor, original_currency → new)` through the shared
   helper and its digit-difference rule; `exchange_rate = r × k`, the re-anchoring of a rate stored
   as `1 source = r old` into `1 source = r × k new`; and **`currency = new`**. The third of those is
   rule 2 and is not optional: a row that gets the first two and not the third is denominated in one
   currency and labelled with another.
6. `settlements` and `budget_items`: the same three-column statement, from their own source triples.
7. `expense_shares`: for every expense the batch touched, recompute `share_minor` from the row's
   stored `weight` values through the shared split helper, so the shares still sum **exactly** to the
   row's new `amount_minor`. `is_settled` is carried through untouched — a paid flag records
   something that happened outside the ledger and is not arithmetic.
8. `UPDATE trips SET currency = new`.

**Backfill: none for the three columns this stage files** — see **Data and migration** above, where
the `NULL` reading is fixed. Trips that never change base are untouched by anything here.

**Refusal beats corruption.** If `k` cannot be resolved, the whole change is refused with a designed
message and nothing is written. Re-anchoring at an invented rate would move real money.

**Two invariants the batch is checked against afterwards, in the same transaction's test**: no row of
the trip has a `currency` other than `new`, and every row's `amount_minor` equals the conversion of
its own source triple. They are named here because they are the two ways the earlier draft's bug
would have shown itself, and both are unit tests below rather than comments.

### Server (repo, server function, Zod)

**Repository — `src/server/repos/trip-currency.ts` (new).** All SQL for the re-basing.

- `previewCurrencyChange(scope, tripId, next)` — what would move: how many expenses, settlements and
  budget items would be pinned, how many rates re-anchored, how many share rows recomputed, how many
  place prices pinned, and the resolved `k`. A read only.
- `changeTripCurrency(scope, tripId, next, { rate })` — the batch above, in one `db.batch()`.

Neither re-implements arithmetic that already exists: the conversion is the shared helper in
`src/lib/money.ts` with its digit-difference rule, and the share recomputation in step 7 goes through
the same exported split helper the expenses repository uses, imported rather than copied — a second
splitter that disagreed with the first by one minor unit is the exact failure this whole file is
written to prevent.

Both start from `requireTrip(scope, tripId)` and build every statement through `tenantFilter()`, so
each `UPDATE` carries `organization_id = ?` in its `WHERE` clause. A bulk `UPDATE` is precisely where
a forgotten tenant predicate does the most damage, and it is the reason this lives in a repository
and not in a server function.

**Server function — `src/server/fns/trip-currency.ts` (new).** `previewCurrencyChangeFn`
(`method: 'GET'`) and `changeTripCurrencyFn` (`method: 'POST'`), the latter returning the counts it
actually moved so the confirmation can be honest after the fact as well as before it. It mirrors to
the trip room under the existing `trip` entity kind — a currency change is a field of the trip row —
so no new patch kind is declared and `src/server/do/protocol.ts` is not touched by this stage.

**Zod (v4).** `z.strictObject()` with `error`; `currencySchema` for both codes; a refinement that the
two differ; the rate as `z.number().finite().positive()`.

**Authorisation.** Decided in the handler, and it is **not** the money permission. The accounting
currency is a field of the trip, so the check is the trip-editing one, resolved through `appScope()`
and `requireTrip()` and re-checked against the member's role in the repository. A reader who may log
an expense may not re-base the trip.

Nothing is enqueued: the batch is bounded by one trip's rows and runs well inside the request budget.
A trip large enough to threaten that is a signal to chunk, and the ceiling is asserted in the
repository with a named constant rather than discovered in production.

### UI (route, components)

**Route.** None added, none edited. No `pnpm generate-routes`.

**Components.** Reused: `Dialog`, `Select` (the same `CURRENCY_OPTIONS` list), `Alert`, `Button`,
`Spinner`, `Badge`, `SectionLabel`, `Separator`, `Tooltip`. New:
`-costs/currency-rebase-dialog.tsx`, route-local for the reason given under **Owned paths** — it has
one caller, and the module barrel that would be needed to reach it from `src/components/costs/` is
held by `04-S4` for this wave.

**The dialog is a confirmation with arithmetic in it, not a warning.** It shows, before anything
moves: the rate it will use and where that rate came from; the counts from the preview; and one
worked example — "the 12,400 JPY dinner stays 12,400 JPY and reads as 74.20 EUR". A reader who can
see one row transformed correctly will trust the other forty; a reader shown only a caution will not.

**States.**

- _Empty_ — not applicable, and stated rather than skipped: the dialog always has content, because a
  trip always has a current currency. A trip with no expenses shows the same dialog with zero counts
  and a line saying nothing needs re-basing, which is a real and reassuring answer.
- _Skeleton_ — the preview is a round trip, so the counts and the example render as `Skeleton` lines
  at their final size on `--color-surface-2`; the confirm button is `disabled` until the preview
  lands, because confirming a change whose consequences have not loaded is not a choice.
- _Error_ — an unresolvable rate renders an `Alert` on `--color-surface-2` naming the pair and the
  reason, with the confirm button disabled and a retry that re-runs the preview. A failed batch keeps
  the dialog open, states that nothing changed, and offers the retry.
- _Loading_ — confirm carries `loading`; the currency `Select` is `disabled` for that window.

**Tokens.** None missing; 4px grid from `--space-*`, `--radius-xl` and `--shadow-modal` from the
token file, dark shadows re-declared. Motion is the `Dialog` primitive's own — 220ms in on
`--ease-out-quint`, 150ms out — and honours `prefers-reduced-motion: reduce` because the primitive
already does.

`font-variant-numeric: tabular-nums` on the rate, the counts and both figures of the worked example.

### Quota

**Creates no countable row.** It updates rows that already exist and creates none, so it consumes no
metric and adds nothing to `resolveLimits()` or `PLAN_QUOTAS`, and no case to
`src/server/billing/__tests__/limits.test.ts`. The bound worth stating is the batch size, which is
held by the named constant above and by a unit test, not by a plan entitlement.

### Tenant isolation test

Appended as its own `describe` block. In A's scope: preview a currency change on B's trip
(`NotFoundError`); execute one on B's trip (`NotFoundError`, and every one of B's expense, place and
settlement rows byte-identical afterwards — this is the case that matters most in this file, because
a bulk `UPDATE` missing its tenant predicate would rewrite another tenant's money and every other
test in the suite would still pass). Then: A re-bases A's own trip and B's rows are still identical,
which is the same assertion from the other side. Functions covered: `previewCurrencyChange` and
`changeTripCurrency` in `src/server/repos/trip-currency.ts`.

### Verification

**Command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests.** `src/server/repos/__tests__/trip-currency.test.ts` (new):

- **Rule 2, the one an earlier draft broke**: after any re-basing, no expense, settlement or budget
  item of the trip carries a `currency` other than the new code, and every one of those rows has
  `amount_minor` equal to the conversion of its own source triple. Asserted over a trip mixing an
  inherited row, a foreign row entered through the shipped expense dialog and a zero-decimal
  currency.
- **Rule 4**: every expense's share rows sum exactly to its new `amount_minor`, for a total and a
  participant count that do not divide evenly, and `is_settled` survives the batch unchanged.
- Re-basing a trip with no foreign expenses pins every inheritor's source triple, moves every code
  and leaves the reader's typed figures readable in `original_amount_minor` unchanged.
- Every member balance nets to the same real value before and after, allowing for one minor unit per
  member of rounding and no more — the invariant the whole stage exists to protect.
- A settled trip stays settled: balances that were zero before are zero after, so nobody is asked to
  pay a phantom debt because the base moved.
- Re-basing into a zero-decimal currency and back returns every amount to its starting value.
- A trip whose accounting currency is not `EUR`, holding an expense in a third currency, re-bases
  correctly — the regression case for a settle-up that reads a hard-coded base instead of the trip's
  own, which is a failure mode worth a permanent test rather than a comment.
- An unresolvable rate writes nothing at all.

**Browser evidence.** `describe` block `04-S5 — trip currency re-basing`, shared helpers only.

- Route: `/trips/$tripId/costs`. Frame set: light and dark at **360px, 1280px and 2560px** at rest.
- **Declared non-resting state**: the re-basing dialog open with a preview loaded and its worked
  example rendered, reached by
  `--click` on `[data-part="trip-currency-change"]`, framed as `--state rebase-preview`; and the
  refusal, reached with `page.route()` failing the preview, framed as `rebase-error`. The first is one
  click from rest and is `capture.mjs`'s; the second is the spec's, because no capture flag can fail a
  request — the harness block below states it. Both selectors are stable `data-part` attributes this
  stage ships, verified with `page.locator(sel).count()` against a running server before capture.

**Console must be silent**, asserted through `watchConsole`. **No layout shift after paint**:
init-script observer, mark after `settle()`, open the dialog and let the preview land, assert `0`
after the mark — the skeleton is sized to its result precisely so this passes — gated on
`supportedEntryTypes` with the WebKit skip stated.

**The harness, quoted in full**, so the port, the session refresh and the clock pin are visible
here rather than inherited from a sentence elsewhere. `2026-08-20` is `BASELINE_DAY`, and
`capture.mjs` installs its header interceptor only when `PT_SERVER_TODAY` is set
(`scripts/ultrabuild/capture.mjs:168-169`), so an unset pin shoots a different day than the gate
compares.

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)

PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/budget-and-currencies.visual.spec.ts
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/budget-and-currencies.visual.spec.ts --update-snapshots -g '04-S5'

PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/$TRIP_ID/costs" \
  --out ".claude/ultrabuild/shots/04-budget-and-currencies/round-<n>/04-S5" \
  --label B --auth \
  --viewports 360x800,1280x900,2560x1440 --themes light,dark

PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/$TRIP_ID/costs" \
  --out ".claude/ultrabuild/shots/04-budget-and-currencies/round-<n>/04-S5" \
  --label B --auth --state rebase-preview \
  --viewports 360x800,1280x900,2560x1440 --themes light,dark \
  --click '[data-part="trip-currency-change"]' --settle 800
```

`--settle 800` is the preview's budget, not a guess at it: the dialog's skeleton is sized to its
result precisely so the frame is stable once the preview lands. `rebase-error` is not `capture.mjs`'s
— it needs `page.route()` to fail the preview request, which the script has no flag for — so it is
reached in the spec and its six frames copied into the same stage directory.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged: build succeeds; lint and typecheck clean with no
suppressions; new logic tested and `pnpm test` passing; verified in a real browser in light and dark,
desktop and mobile; nothing left behind; no file outside **Owned paths** touched.

- [ ] Spacing on the 4px grid from `--space-*`, no eyeballed one-off margins.
- [ ] Hover, focus-visible, active, disabled and loading on the currency `Select`, the confirm and
      cancel buttons and the retry.
- [ ] Designed empty, skeleton and error states for the preview, each on `--color-surface-2`.
- [ ] Motion 150–260ms on `--ease-out-quint` or a sibling, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured.
- [ ] Light and dark parity with dark shadows re-declared.
- [ ] 360px → 2560px, where the dialog is a full-height sheet on small rather than a shrunken modal.
- [ ] Keyboard navigable end to end, focus trapped and restored by the `Dialog` primitive, accessible
      names, WCAG 2.2 AA contrast in both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.
- [ ] `tabular-nums` on the rate, the counts and the worked example.

### Blockers

**One, inherited rather than new.** Re-anchoring frozen rates needs an old-to-new rate, and no
foreign-exchange provider is chosen — the same constraint `04-S1` records, dispositioned **defer** in
`11-boundaries-and-blockers.md` (`11-S3`). This stage is not blocked from shipping by it: the rate is
resolved through `src/server/repos/rates.ts`, which answers from a rate the reader supplies in the
dialog or from one the workspace has already frozen for that pair, and refuses the change when it can
answer with neither. When `04-S7` lands a provider, the same call starts answering automatically and
no surface changes.

`TRP-03` (`01-trips-core.md`, wave 1) is neither a dependency nor a blocker: it may call this stage's
server function from the trip edit surface, and if it slips or never does, this stage still ships its
own entry point in the money toolbar and closes `MNY-06` on its own.

**One precondition inherited from the harness, recorded here because `12-verification-protocol.md`
§7.2 requires the stage that baselines a trip tab to carry it rather than absorb it.** Every stage in
this file baselines `/trips/$tripId/costs`, which is a trip tab, and seven call sites still construct
their own `Intl.DateTimeFormat` with `month: 'short'` — two of them in `src/components/costs/data.ts`
— which workerd and WebKit abbreviate differently. Disposition: **report**. None of those files is in
this stage's **Owned paths**, so it repairs none of them; it widens no diff budget, which §5 of the
same file forbids outright; and it attributes a `mobile-safari` difference of that shape rather than
re-recording a baseline over it. §7.3 rides with it: nothing in the repository pins the browser
revisions behind these baselines, so a green comparison proves this stage changed nothing on this
machine and is not a claim about a second one.

## Stage 04-S6 — Split a receipt fairly and clear the debts

### Stage id

`04-S6` · Wave 3 · effort **M**. Depends on `04-S3`, and through it on `04-S2`. The only stage of
this plan in wave 3, so its owned paths cannot collide with a sibling.

### Reference rows

- `MNY-03` partial → **done**. What already works, measured rather than assumed, because an earlier
  draft of this stage claimed the settle-up flow was missing and it is not:

  - `computeShares` (`src/server/repos/expenses.ts:151`) covers equal, weighted, exact and percentage
    splits, and `src/components/costs/split-editor.tsx` is its editor.
  - `suggestSettlements` **has a caller**: `loadCosts` invokes it in the same `Promise.all` as the
    other five aggregate reads (`src/server/fns/costs.ts:335`, imported at `:33`).
  - The suggestions are **already rendered as accept-able transfers**: the settle-up panel lists one
    row per suggested transfer with both avatars, the direction and the amount, and a working
    `Settle` button (`-costs/rail.tsx:140-170`) whose handler pre-fills the payment dialog with the
    payer, the payee and the amount (`-costs/screen.tsx:178-187`). `recordPaymentFn` then writes the
    settlement (`src/server/fns/costs.ts:460-482`).

  So the settle-up surface is not the gap. **Three** things are, and this stage adds exactly those:

  1. **A deterministic remainder rule** that does not always favour the top of the list. Both
     implementations hand the remainder to the first participants in list order today —
     `computeShares` (`src/server/repos/expenses.ts:196-204`) and `distribute`
     (`src/lib/money.ts:391-403`).
  2. **Itemised splitting**, where different lines of one receipt carry different participants.
     Nothing in the schema or the editor expresses this today.
  3. **A per-member paid toggle.** `markShareSettled` (`src/server/repos/expenses.ts:391`) genuinely
     has no caller — `grep -rn markShareSettled src/` returns its definition and nothing else — so
     `expense_shares.is_settled` can be read but never written by the product.

  A settlement recorded in a currency other than the trip's is **not** this stage's work either:
  `recordPaymentFn` hard-codes `currency: trip.currency` (`src/server/fns/costs.ts:470`) today, and
  `04-S1` is the stage that gives it the source triple `00-S1` adds to `settlements`. This stage
  inherits that and adds nothing to it.

Sourced from `wiki: Budget-Tracking`.

### Owned paths

- `src/lib/money.ts` — edit. The one exported remainder helper both sides import.
- `src/lib/__tests__/money.test.ts` — edit.
- `src/server/repos/expenses.ts` — edit. `computeShares`, the ticket-line writers and
  `markShareSettled`'s guard.
- `src/server/repos/__tests__/expenses-split.test.ts` — new.
- `src/server/fns/costs.ts` — edit. Ticket lines on the update endpoint, and the paid toggle.
- `src/components/costs/split-editor.tsx` — edit. Ticket mode and the three-state chip.
- `src/routes/_app/trips/$tripId/-costs/expense-list.tsx` — edit. The quiet line already prints the
  reader's own share (`expense-list.tsx:167-170`); it gains the marker that says when that share is
  recorded as paid.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. One new `describe` block.
- `e2e/budget-and-currencies.visual.spec.ts` — append. This stage's own `describe` block.
- `e2e/__screenshots__/budget-and-currencies.visual.spec.ts/` — append. The baseline directory
  `playwright.config.ts:49-50` derives from that spec's file name, so
  `--update-snapshots -g '04-S6'` writes this stage's own frames into it whether the stage
  names it or not. It is named because writing into a path a stage did not declare fails
  `docs/SPEC.md` §7 item 6. `append`, not `edit`: every frame name begins with the stage id, so
  this stage adds its own PNGs and overwrites nobody else's.

`src/components/costs/payment-dialog.tsx` and `-costs/rail.tsx` were on an earlier draft of this list
and are **not** claimed: the accept-a-suggestion path they would have carried already exists and
works, and a stage does not take a file it has no edit to make in. `src/server/repos/expenses.ts`
and `src/server/fns/costs.ts` are held by `00-S1` and `00-S2` (`00-foundations.md`, wave 0) and by
`04-S1` (wave 1) and `04-S3` (wave 2); this stage is wave 3 and is the last of the four, so no claim
is a same-wave one.

### Data and migration

One new table, filed to `00-foundations.md` — to the schema stage that **closes before wave 3
opens**, for the reason `04-S3` states: a column or table supplied by a stage in the same wave has
not landed when the stage that needs it starts. This stage does not name `src/server/db/schema.ts`
and does not write `drizzle/`.

**`expense_ticket_lines`** — one line of an itemised receipt:

| Column                      | Type                           | Notes                                                                                                                                                                                                                                                                                                          |
| --------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                        | `text` PK                      | `newId()`.                                                                                                                                                                                                                                                                                                     |
| `organization_id`           | `text` NOT NULL                | `orgRef()`, leading column of every index.                                                                                                                                                                                                                                                                     |
| `trip_id`                   | `text` NOT NULL                | References `trips.id`, cascade. Carried so the tenant filter never needs a join.                                                                                                                                                                                                                               |
| `expense_id`                | `text` NOT NULL                | References `expenses.id`, cascade — the line has no meaning without its receipt.                                                                                                                                                                                                                               |
| `label`                     | `text` NOT NULL                |                                                                                                                                                                                                                                                                                                                |
| `receipt_amount_minor`      | `integer` NOT NULL default `0` | The figure printed on that line of the receipt, an integer in the minor unit of the **receipt currency** defined below. The line carries no currency column of its own, so a line can never disagree with its receipt, and the name says which of the parent's two denominations it is in. `nonNegativeCheck`. |
| `participants`              | `text` json                    | The user ids sharing this line.                                                                                                                                                                                                                                                                                |
| `sort_order`                | `real`                         | `sortOrder()`.                                                                                                                                                                                                                                                                                                 |
| `created_at` / `updated_at` | `integer`                      | `timestamps()`.                                                                                                                                                                                                                                                                                                |

Indexes: `expense_ticket_lines_org_expense_idx` on `(organization_id, expense_id)` and
`expense_ticket_lines_expense_sort_idx` on `(expense_id, sort_order)`.

**"Receipt currency" is defined once, here, and every stage sentence below uses it in exactly this
sense.** The receipt currency of an expense is `original_currency` when that column is set and
`currency` when it is `NULL` — that is, the denomination the reader actually read off the piece of
paper. `expenses.currency` is the **accounting** currency, always the trip's own, and
`expenses.amount_minor` and `expense_shares.share_minor` are always in it
(`src/server/db/schema.ts:791-795`, `:830`). A ticket line is denominated in the receipt currency and
never in the accounting currency, which is why the column is named `receipt_amount_minor` rather than
`amount_minor`: an earlier draft of this stage called it `amount_minor`, said it held the source
currency, and then wrote the sum of the lines into `expenses.amount_minor`. On a foreign receipt that
stores a source-currency figure in an accounting-currency column and derives every `share_minor` from
it — the whole trip's balances wrong by the exchange rate, silently, with every same-currency test
still green. The conversion step that draft was missing is stated in full under **Server**, and the
column name is what stops the mistake being re-made by reading the schema alone.

**Why participants are JSON rather than a join table.** They are never queried across receipts: they
exist to compute shares at write time and to restore the editor on re-open. The queryable truth stays
`expense_shares`, which this stage keeps writing exactly as it does today, so every balance,
aggregate and settlement continues to read one table. A join table would add a second tenant-scoped
entity for a set that is only ever read whole.

**`expenses.split_method`** gains one value, `ticket`, alongside the four in `SPLIT_METHODS`
(`schema.ts:202`). Adding a value to the list widens the generated `enumCheck`, which drizzle-kit
emits as a table rebuild on SQLite; the rebuild is accepted here because `0001` shows the shape is
already established for this table and because the alternative — a fifth mode outside the check — is
a constraint that no longer constrains. The rebuild copies every column and drops none, so a rollback
still reads every row it wrote.

**Backfill: none.** Existing expenses keep their split method and have no ticket lines; a row with no
lines and a non-`ticket` method behaves exactly as it does today.

Money stays integer minor units. Both of a receipt's denominations live on the parent row and are
paired with their own `text(3)` ISO-4217 code there — `amount_minor` with `currency`,
`original_amount_minor` with `original_currency` — and a line carries a minor-unit integer in the
receipt currency and no code of its own, so there is exactly one place a currency can be recorded and
exactly one thing it can mean.

### Server (repo, server function, Zod)

**The deterministic rounding rule, stated in full because it is the fairness guarantee.**

A split of `T` minor units across `n` participants with weights `w₁ … wₙ` summing to `W`:

1. Order participants by user id ascending. The order is derived from the data, never from the array
   the client happened to send, so two clients splitting the same receipt agree.
2. Base share for participant `i` is `bᵢ = floor(T × wᵢ / W)`.
3. The remainder is `r = T − Σ bᵢ`, and `0 ≤ r < n` by construction.
4. Hand out `r` single minor units, one each, starting at index `rotation = seed mod n` and wrapping.
   Each of the `r` recipients gets exactly one.

**The seed is derived from the split itself, and deliberately not from the expense id.** It is
`fnv1a` over the canonical string `` `${T}|${spentOn}|${orderedParticipantIds.join(',')}` `` — the
total in minor units, the date on the receipt, and the same ascending id order step 1 already fixed.

That choice is the whole reason this rule is implementable. An earlier draft keyed the rotation off
the expense id, and an expense id **does not exist at preview time**: `newId()` runs server-side
inside `createExpense`, so the dialog computing a preview for a receipt the reader has not saved yet
has nothing to hash. Keyed that way, the two guarantees this stage sells — that the preview under the
editor and the rows that get written can never disagree, and that a test can assert they match byte
for byte — are unsatisfiable on the create path, which is the path most splits take. Every field of
the seed above is present in the form before submit and present in the submitted body afterwards, so
the client and the server compute the same integer from the same three values, on create and on
update alike.

`Σ shares = Σ bᵢ + r = T` identically, for every `T`, every `n` and every weight vector — the sum is
exact by construction rather than by a corrective adjustment on the last row. Because the seed moves
with the total and the date, the extra unit lands on a different traveller from receipt to receipt
instead of always on whoever sorts first, so over a trip nobody is systematically overcharged. Two
receipts that agree on all three seed fields do get the same rotation; that is a consequence of the
result being a pure function of the data rather than a defect, and it is what lets a re-render, a
re-submit and a re-read all agree. Editing a saved expense's total or date re-seeds the rotation,
which is harmless because every share is recomputed on that write anyway and the sum stays exact —
stated here so a reader who notices the shift knows it was intended.

Both of today's implementations are changed to the rule above, in the same commit, from **one**
exported helper in `src/lib/money.ts` that the repository imports, so the preview under the editor
and the rows that get written can never disagree. `exact` splits keep bypassing the rule entirely and
keep being validated to sum to the total.

**Repository — `src/server/repos/expenses.ts` (edit).**

- `computeShares` delegates its remainder handling to the shared helper and gains the `ticket`
  method, **which is a weighted split and not a second splitter**. The lines decide the weights; the
  existing rule then divides the accounting total. In order:

  1. Each line's `receipt_amount_minor` is divided among that line's own participants **by the same
     helper**, seeded from its own canonical string
     `` `${receiptAmountMinor}|${label}|${orderedParticipantIds.join(',')}` `` — no line id is needed,
     so a line the reader has not saved yet previews identically. A participant's weight is the sum of
     the per-line integers they were handed. Because the helper is exact on every line, the weights
     are **integers summing exactly to `L`**, the receipt total: no rational is carried, nothing is
     rounded at this step, and the receipt-space arithmetic can never disagree with itself. Weights
     are receipt-currency quantities, and they are the **only** thing the lines contribute.
  2. The single split then divides `expenses.amount_minor` — the accounting total, in the trip's own
     currency — across those weights, through the one deterministic remainder helper above, seeded
     from `` `${amountMinor}|${spentOn}|${orderedParticipantIds.join(',')}` `` exactly as every other
     method is. So `Σ share_minor = amount_minor` identically, and `expense_shares` stays wholly in
     the accounting currency, which is the only currency it has a column for.

  **No line is ever converted, and no figure is converted twice.** The helper runs twice, but in two
  different spaces and with two different jobs: in step 1 it partitions the receipt total `L` into
  integer weights, entirely inside the receipt currency; in step 2 it partitions the accounting total
  `amount_minor`, entirely inside the accounting currency. Conversion itself happens exactly once, at
  the parent row, which is the netting order the money conventions at the top of this file fix. A
  fifteen-line foreign receipt therefore crosses the currency boundary once and not fifteen times,
  which is the difference between a balance that clears and a set of phantom one-unit debts.

- **What the lines write into the parent row, stated as an assignment because that is what an
  implementer needs.** Let `L` be the sum of every line's `receipt_amount_minor`, computed on the
  server and never accepted from the client.

  - **Receipt in the trip's own currency** (the common case, `original_currency IS NULL`):
    `amount_minor := L`. `L` is already an accounting-currency figure, so there is no conversion and
    the source triple stays `NULL`.
  - **Foreign receipt** (`original_currency` set): `original_amount_minor := L`, and `amount_minor`
    is the converted total **the reader supplied** in the field the expense dialog has carried since
    HEAD (`src/components/costs/expense-dialog.tsx:332-356`) — itemising a receipt changes which
    figure the source amount comes from, and changes nothing about where the converted one comes
    from. `exchange_rate` is then derived by `impliedRate(L, amountMinor)`, the same derivation
    `toRepoInput` already runs (`src/server/fns/costs.ts:283-301`). **This stage introduces no rate
    input and no automatic conversion of a receipt total**, exactly as `04-S1` fixed for every other
    money write in this file.
  - A foreign ticket receipt submitted with lines but no converted total is refused with
    `RepositoryError('...', 'CONVERSION_INCOMPLETE')` — the same refusal, with the same reason,
    `04-S1` gives a foreign settlement. Nothing is written and the editor keeps the reader's lines.

- **Re-basing composes with this and needs no change to `04-S5`.** Step 7 of that stage's batch
  recomputes every `share_minor` from the row's stored `expense_shares.weight` after a trip changes
  accounting currency. Ticket mode therefore **stores the weights it derived** into that existing
  column, normalised exactly as every other method's weights are, so a re-based ticket expense
  re-splits correctly from data `04-S5` already reads — and `04-S5`, which lands a wave earlier, is
  neither edited nor named as an owned path by this stage. The lines themselves are untouched by a
  re-base: `receipt_amount_minor` is a fact about a piece of paper, and a trip changing its
  accounting currency does not change what the receipt said.
- Ticket lines are written and replaced inside one `db.batch()` with the shares they imply, so a
  receipt is never half-itemised.
- `markShareSettled` gains its first caller and is not rewritten: it is correct and unreached, which
  is a wiring problem rather than a code problem. `suggestSettlements` is **not** touched at all — it
  is already called by `loadCosts` and already rendered as accept-able transfers — but its input
  changes, because the balances it greedily matches are now netted from shares produced by the
  corrected remainder rule. That is why its output is asserted below rather than assumed stable.
- The settle-up read converts exactly once: balances net in the trip's accounting currency, and the
  reader's display currency is applied to the netted figure at the end. A regression test covers a
  non-`EUR` trip currency holding a foreign-currency expense, which is the case a hard-coded base
  gets wrong while every same-currency test still passes.

Every query keeps starting from `tenantFilter()`; `requireTrip()` re-resolves the parent before any
write; a participant id from the client is checked against the trip's own membership inside the
scope, because a well-formed user id is not a member of this trip.

**Server functions — `src/server/fns/costs.ts` (edit).** Two changes and no more. `updateExpenseFn`
accepts ticket lines, and `markSharePaidFn` (new, `method: 'POST'`) toggles a share's settled flag.
**No accept-a-suggestion endpoint is added**: `recordPaymentFn` already records the settlement a
suggestion becomes, the `Settle` button already pre-fills it, and a second endpoint for the same
write would be a second source of truth for what a settlement is. Both changes mirror to the trip
room under the existing `expense` kind — no new patch kind, so `src/server/do/protocol.ts` is not an
owned path of this stage.

**Zod (v4).** `z.strictObject()` with `error`; ticket lines as a bounded array (at most 50) of
`{ label, receiptAmountMinor, participants }`, `receiptAmountMinor` a non-negative integer and
`participants` a non-empty unique id array; a refinement that at least one line exists when the
method is `ticket`; a refinement that a foreign receipt in `ticket` mode carries the converted total,
so the all-three-or-none source rule `04-S1` fixed still holds when the source figure comes from the
lines; and no field anywhere in the body called a rate. `z.iso.date()` on `settledOn`. **No total is
accepted for a ticket expense's source amount** — the server sums the lines — which is expressed at
the boundary by the field simply not existing on the input. Validation is shape; membership and
permission are decided in the handler and the repository.

### UI (route, components)

**Route.** None added, none edited. No `pnpm generate-routes`.

**Components.** Reused: `Avatar` and `AvatarStack`, `Chip` (the participant chips), `Checkbox`,
`Input`, `Select`, `Button`, `IconButton`, `Badge`, `Progress`, `Separator`, `Tooltip`, `Alert`,
`EmptyState`, `Skeleton`. Edited in place, and only these two: `split-editor.tsx` gains ticket mode
and the three-state participant chip, and `expense-list.tsx` gains the marker that says a share is
recorded as paid. The settle-up panel in `-costs/rail.tsx` and `payment-dialog.tsx` are **left
alone** — they already do their job, and the shortest way to make a finished surface worse is to
rebuild it for a stage that had no change to make to it.

**Three interaction rules worth fixing in the plan.**

- A participant chip has three states, not two: not included, included, and included-and-paid. The
  third is reached deliberately — a separate control with its own accessible name, not a second click
  on the same target — because a two-click overload makes "paid" reachable by accident and unsettling
  a debt by accident is not recoverable by an undo the reader will find.
- The custom-amount mode will not save until the lines balance exactly to the total, and the
  difference is shown as a signed figure the whole time, so the reader is corrected while they type
  rather than at submit.
- Ticket mode sums its lines into the receipt total, so **the amount field the lines produce becomes
  read-only** with a tooltip naming the lines that produced it. On a receipt in the trip's own
  currency that is the one amount field. On a foreign receipt it is the **source** field that locks;
  the converted field stays editable, because that figure is the reader's bank statement and not
  arithmetic this product is entitled to invent — the derived-rate rule `04-S1` states, applied to an
  itemised receipt. Both figures carry `tabular-nums`, and the currency code sits beside each so it
  is never ambiguous which denomination a reader is looking at.

**States.**

- _Empty_ — a trip with one member renders the split editor as a single explanatory line rather than
  a picker with one option; ticket mode with no lines yet renders an `EmptyState` on
  `--color-surface-2` offering the first line inline. The settle-up panel's own empty state already
  exists and already reads as a result rather than an absence (`-costs/rail.tsx:128-138`); this stage
  does not touch it.
- _Skeleton_ — the ticket-line list renders `Skeleton` lines at final height while a re-opened
  expense's lines load, so the editor does not grow under the reader's cursor. The screen-level
  skeleton is `CostsSkeleton`, which this stage does not own and does not need to change: no surface
  it ships adds a line to the resting screen.
- _Error_ — an unbalanced custom split blocks the save and names the difference; a failed paid-toggle
  reverts the chip and raises a `sonner` toast with a retry; a rejected ticket line keeps the editor
  open with its values intact.
- _Loading_ — the chip being toggled is `aria-busy` with its control `loading`; the other chips stay
  interactive, because marking three shares should not be three modal waits.

**Tokens.** None missing. 4px grid from `--space-*`; the paid state is carried by
`--color-success` plus a shape change, never by colour alone; dark re-declares its own shadows.
Motion: a cleared transfer leaves with a 150ms opacity and transform exit on `--ease-out-quint`, and
the list re-flows without animating layout properties; all of it collapses under
`prefers-reduced-motion: reduce`.

`font-variant-numeric: tabular-nums` on every share, every ticket line, every per-participant sum and
the running difference in the custom mode — that last one changes on every keystroke and is the
single most jitter-prone figure on the screen.

### Quota

**Creates countable rows and deliberately does not meter them**, for the reason given in `04-S2`:
ticket lines, shares and settlements are children of an expense, bounded by the input limits above
(50 lines per receipt, 100 participants per split), and no plan sells an allowance for any of them.
`CATALOGUE_METRICS` and `PLAN_QUOTAS` are unchanged, `resolveLimits()` gains nothing, and no case is
added to `src/server/billing/__tests__/limits.test.ts`. The bounds are Zod input limits asserted in
the repository before the write, each a named constant beside its reason and each held by a unit
test.

### Tenant isolation test

Appended as its own `describe` block. In A's scope: read, list, update and delete B's ticket lines by
id; add a ticket line to B's expense; and toggle the paid flag on B's expense share. Every one is a
`NotFoundError`, and B's expense, share and ticket-line rows are byte-identical afterwards. Then the
crossing case: add a ticket line to one of A's expenses naming one of B's users as a participant —
rejected, because a participant must be a member of the trip resolved in the caller's scope, and a
well-formed foreign user id is not one. `suggestSettlements` is asked, in A's scope, for B's trip and
answers `NotFoundError`; it is covered here rather than changed, because this stage moves the
balances it reads.

Functions covered: `computeShares`, `markShareSettled`, `suggestSettlements` and the new ticket-line
writers in `src/server/repos/expenses.ts`.

### Verification

**Command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests, by file and invariant.**

- `src/lib/__tests__/money.test.ts` (edit) — **the required proof that a remainder that does not
  divide evenly still sums exactly**: splitting 1000 minor units across 3 participants produces
  shares summing to exactly 1000, with two participants on 333 and one on 334, and the 334 landing on
  the participant the rotation selects for that seed rather than always on the first. Extended
  to a loop over every total from 1 to 200 against every participant count from 2 to 7, asserting for
  each that the shares sum to the total exactly, that no two shares differ by more than one minor
  unit, and that the same inputs produce the same output on a re-run. And, across a hundred distinct
  `(total, spentOn)` pairs at `n = 3`, that every participant is selected as the remainder recipient
  at least once — the property the rotation exists to provide, and the one a fixed order fails.
  Every case in this file is computed **without an expense id**, which is the test that would have
  caught the earlier draft: the helper's signature takes no id, so a rotation that needed one could
  not compile.
- `src/server/repos/__tests__/expenses-split.test.ts` (new) — the repository's shares match the
  client preview for identical inputs, byte for byte, **on the create path as well as the update
  path**: the preview is computed from a form state with no expense id at all, the row is then
  written, and the stored `expense_shares` are compared against that preview element by element; a
  ticket expense's receipt total equals the sum of its lines and a client-supplied total is ignored;
  per-line participants produce per-participant shares that add back to `expenses.amount_minor`
  exactly, and the weights those lines produced are integers adding back to the receipt total `L`
  exactly — the two spaces are asserted separately, because a test that only checks the accounting
  sum passes even when the receipt-space arithmetic is wrong; **the foreign-receipt case, which is the one an earlier draft got wrong** — a `JPY`
  receipt of four lines on a `EUR` trip stores `Σ` lines in `original_amount_minor`, the reader's
  converted figure in `amount_minor`, `impliedRate` of the pair in `exchange_rate`, and shares that
  sum to `amount_minor` and **not** to the yen total, with a same-currency ticket receipt asserted in
  the same test to produce identical shares to the equal split it degenerates into; a percentage
  split still has to add to 100; an exact split still has to balance; `markShareSettled` moves nothing in the balances, which is a
  property of the code rather than a wish — `getMemberBalances` sums `expense_shares.share_minor`
  with no predicate on `is_settled` (`src/server/repos/expenses.ts`), so a paid flag records that a
  debt was cleared outside the ledger without changing the arithmetic, and the test pins that so a
  later stage cannot make the flag load-bearing by accident; and `suggestSettlements`, whose input
  this stage moves, still clears every balance to zero in at most `members − 1` transfers under the
  new remainder rule.
- The non-`EUR` regression: a trip whose accounting currency is not `EUR`, holding one
  foreign-currency expense, produces the same balances whether the reader's display currency is the
  trip's own or another — proof that netting happens in the accounting currency and conversion
  happens once, at the end.

**Browser evidence.** `describe` block `04-S6 — splitting and settle-up`, shared helpers only.

- Route: `/trips/$tripId/costs`. Frame set: light and dark at **360px, 1280px and 2560px** at rest.
- **Declared non-resting states**, because every one of them is the point of the row: the split
  editor in ticket mode with two lines and different participants on each, reached through
  `[data-part="split-mode-ticket"]`, framed as `ticket`; and a participant chip in its
  included-and-paid state, reached through `[data-part="share-paid-toggle"]`, framed as `chip-paid`.
  Both live inside the expense dialog, so both take two steps and both are the spec's rather than
  `capture.mjs`'s — the harness block below states it. Each selector is a stable `data-part` attribute
  this stage ships and each is verified with `page.locator(sel).count()` returning 1 against a running
  server before capture. The
  settle-up panel is **not** a declared state of this stage: it already renders its transfers and its
  `Settle` button at HEAD, this stage changes neither, and photographing a surface a stage did not
  touch is evidence about somebody else's work.
- The unbalanced-custom-split error is reached by typing an unbalanced value, not by mocking.

**Console must be silent**, asserted through `watchConsole` in every test of the block. **No layout
shift after paint**: init-script observer, mark after `settle()`, then switch split modes, add a
ticket line and toggle a share paid, assert `0` after the mark, gated on `supportedEntryTypes` with
the WebKit skip stated.

**The harness, quoted in full**, so the port, the session refresh and the clock pin are visible
here rather than inherited from a sentence elsewhere. `2026-08-20` is `BASELINE_DAY`, and
`capture.mjs` installs its header interceptor only when `PT_SERVER_TODAY` is set
(`scripts/ultrabuild/capture.mjs:168-169`), so an unset pin shoots a different day than the gate
compares.

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)

PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/budget-and-currencies.visual.spec.ts
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/budget-and-currencies.visual.spec.ts --update-snapshots -g '04-S6'

PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/$TRIP_ID/costs" \
  --out ".claude/ultrabuild/shots/04-budget-and-currencies/round-<n>/04-S6" \
  --label B --auth \
  --viewports 360x800,1280x900,2560x1440 --themes light,dark
```

**Neither declared state is one step from rest, so neither is `capture.mjs`'s.** The split editor
lives inside the expense dialog, so `ticket` needs the dialog opened and then
`[data-part="split-mode-ticket"]` clicked, and `chip-paid` needs the dialog, a participant chip and
then `[data-part="share-paid-toggle"]`; `capture.mjs` applies one `--click` per invocation
(`scripts/ultrabuild/capture.mjs:218-224`). Both are driven in this plan's spec and their frames
written with `page.screenshot({ path: testInfo.outputPath(name) })` into `test-results/`
(`playwright.config.ts:51`) and copied into the same round and stage directory as the resting set —
six frames each, three widths, both themes. The unbalanced-split error frame is reached the same way,
by typing an unbalanced value rather than by mocking anything.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged: build succeeds; lint and typecheck clean with no
suppressions; new logic tested and `pnpm test` passing; verified in a real browser in light and dark,
desktop and mobile; nothing left behind; no file outside **Owned paths** touched.

- [ ] Spacing on the 4px grid from `--space-*`, no eyeballed one-off margins.
- [ ] Hover, focus-visible, active, disabled and loading on every chip, every ticket-line control and
      the paid toggle.
- [ ] Designed empty, skeleton and error states for the ticket-line list, each on
      `--color-surface-2`.
- [ ] Motion 150–260ms on `--ease-out-quint` or a sibling, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured.
- [ ] Light and dark parity with dark shadows re-declared; the paid state legible in both without
      relying on hue alone.
- [ ] 360px → 2560px, where the ticket editor is a designed vertical form on small rather than a
      compressed grid.
- [ ] Keyboard navigable end to end — including adding a line, assigning its participants and
      toggling a share paid — with sensible focus order, accessible names and WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.
- [ ] `tabular-nums` on every share, ticket line, per-participant sum and the running difference.

### Blockers

**Nothing stops this stage.** It writes no settlement column and needs no rate: the settlement source
triple lands in wave 0 (`00-S1`) and is written by `04-S1` in wave 1, both of which close before wave
3 opens. Its one schema requirement — the `expense_ticket_lines` table and the fifth `split_method`
value — is filed above to the schema stage of the wave that closes before this one. No package
outside the pinned set, no binding, no third-party service.

**One precondition inherited from the harness, recorded here because `12-verification-protocol.md`
§7.2 requires the stage that baselines a trip tab to carry it rather than absorb it.** Every stage in
this file baselines `/trips/$tripId/costs`, which is a trip tab, and seven call sites still construct
their own `Intl.DateTimeFormat` with `month: 'short'` — two of them in `src/components/costs/data.ts`
— which workerd and WebKit abbreviate differently. Disposition: **report**. None of those files is in
this stage's **Owned paths**, so it repairs none of them; it widens no diff budget, which §5 of the
same file forbids outright; and it attributes a `mobile-safari` difference of that shape rather than
re-recording a baseline over it. §7.3 rides with it: nothing in the repository pins the browser
revisions behind these baselines, so a green comparison proves this stage changed nothing on this
machine and is not a claim about a second one.

## Stage 04-S7 — Turn a chosen rate provider on behind the seam that already exists

### Stage id

`04-S7` · Wave 6 · effort **S**.

Wave 6 is a floor, not a start date. It is the last wave `README.md` defines and the earliest one
this stage could ever occupy — every row it enables sits in wave 1, 2 or 3 — and the stage is
**additionally** gated on the provider decision recorded in `11-boundaries-and-blockers.md`
(`11-S3`). Wave 6 opening does not release it; the decision does, and until then it is not
scheduled. The wave is stated anyway because a stage that states none is invisible to
`scripts/ultrabuild/check-plan-collisions.mjs`, and this stage takes `src/server/repos/rates.ts`
exclusively. Effort **S** covers the code; the decision it waits on carries a cost rather than an
effort.

### Reference rows

**Closes no row.** It lands the one behaviour `04-S1` defers, and `MNY-07` is closed by `04-S1`.

The deferred behaviour, restated precisely: converting a reader's view into a currency that is not
any trip's own accounting currency, at live rates. The per-expense half of `MNY-07` — a source
currency, a converted amount and a rate frozen at save time and never recomputed — already ships at
HEAD; `04-S1` adds the rest of the row, namely settlements under the same rule, the conversion
arithmetic and the display preference's other two states.

Four rows across three other plans wait on the same decision and become buildable with this stage:
`TRP-05` (`01-trips-core.md`), `COL-10` (`07-collaboration-and-sharing.md`), `ACC-04`
(`09-account-and-settings.md`) and, for its re-anchoring convenience rather than its correctness,
`MNY-06` in this file.

### Owned paths

- `src/server/repos/rates.ts` — edit. One implementation of the port `04-S1` defined.
- `src/server/repos/__tests__/rates.test.ts` — edit.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. Its own new `describe` block for
  the cache-key rule below, editing none of the existing ones.
- `e2e/budget-and-currencies.visual.spec.ts` — append. This stage's own `describe` block.
- `e2e/__screenshots__/budget-and-currencies.visual.spec.ts/` — append. The baseline directory
  `playwright.config.ts:49-50` derives from that spec's file name, so
  `--update-snapshots -g '04-S7'` writes this stage's own frames into it whether the stage
  names it or not. It is named because writing into a path a stage did not declare fails
  `docs/SPEC.md` §7 item 6. `append`, not `edit`: every frame name begins with the stage id, so
  this stage adds its own PNGs and overwrites nobody else's.

Deliberately small. `04-S1` builds the port, the cache, the refusal path and every surface that
consumes a rate; this stage supplies one implementation of the port. If landing a provider requires
more than these four files, the seam `04-S1` built was wrong and that is the finding, not the
workaround.

The isolation suite is `append`, not `edit`: the case this stage owns is the cache-key rule, which is
its own subject and its own block, so it never edits the block `04-S1` wrote.

Its two exclusive claims — `src/server/repos/rates.ts` and its test — are both held by `04-S1` in
wave 1, four waves earlier, so they are cross-wave and legal rather than a collision. That is a
**checked** result and not an asserted one, which is the reason this stage states wave 6 in its
**Stage id** rather than leaving the wave blank: `check-plan-collisions.mjs` buckets every wave-less
stage into one group and can only report that it could not check them, so a wave-less stage holding
a module exclusively is a claim nobody can verify.

### Data and migration

**No schema change, and this is the point of deferring rather than guessing.**
`11-boundaries-and-blockers.md` (`11-S3`) records the sequence as decision, then column, then
feature — never a schema shaped around a provider nobody has chosen, because what a provider licenses
us to **retain** differs from provider to provider and is often the binding term.

A rate that is merely cached, not retained, needs no table: the `KV` binding already exists and
`04-S1` already writes through it. If the chosen provider's terms require a retention record — a
snapshot of what was published on a given day, held for audit — that is one additive table filed to
`00-foundations.md` at that time, holding any amount as an integer in minor units paired with a
separate `text(3)` ISO-4217 currency column, exactly as every other table in this area.

**Backfill: none, in either case.** Rates already frozen onto expenses and settlements are historical
facts and are never recomputed; that is what "frozen" means, and a stage that backfilled them would
re-open trips that were settled.

### Server (repo, server function, Zod)

**Repository — `src/server/repos/rates.ts` (edit).** One implementation of the `RateSource` port.
The rules it must satisfy, all of which are contracts `04-S1` already relies on:

- The outbound call is never made on the request path when the cache can answer it
  (`docs/ARCHITECTURE.md` §4).
- The credential is a secret, set through `wrangler secret`, never a checked-in value and never
  something a tenant supplies. A per-tenant third-party credential is the shape that put a whole row
  out of scope in `11-S1` and it does not become acceptable here.
- A cache key is a currency pair and a date. That is a public fact and is correctly shared across
  tenants. Nothing derived from tenant data — a trip id, a member id, an amount — may appear in a
  key, because a key containing tenant data is tenant data.
- Failure is `null`, which the existing surfaces already render as a designed refusal. A provider
  outage must not become an invented rate.
- The call rate is a metered outbound cost a noisy tenant can inflict on every other, so its ceiling
  belongs in `resolveLimits()` like every other ceiling, never in a constant inside this module.

**This stage writes no row and adds no SQL**, which is why it names no table and files no migration.
The one tenant-scoped query in the module is `findLatestFrozenRate`, shipped by `04-S1`: it starts
from `tenantFilter()` in `src/server/repos/base.ts`, so every statement carries
`organization_id = ?` as its leading predicate before the trip predicate is `AND`-ed on. This stage
does not touch it, does not widen it and does not add a second read beside it — the port it
implements is an outbound `fetch` and a `KV` read, neither of which reaches D1 at all. The isolation
block appended below asserts that separation rather than assuming it.

**No server function, no new Zod input, no UI.** The surfaces already exist and call `resolveRate`;
this stage changes what that call can answer with. The one visible change is
that display-currency options `04-S1` renders disabled become enabled, which is a data-driven state
the control already has. It changes nothing about what gets **stored**: a stored `exchange_rate` is
still derived from an amount pair a reader saw, never from this provider, and no writer gains a rate
parameter here either.

### UI (route, components)

**None.** No route, no component, no token. The stage's entire visible effect is that options already
rendered — and already explained as unavailable — stop being disabled. Any figure that becomes
visible through it is rendered by a surface `04-S1` already shipped, with
`font-variant-numeric: tabular-nums` already applied there.

### Quota

**Creates no countable row.** It adds the outbound call whose ceiling is described above. If the
provider's pricing makes the call worth metering per tenant, the metric is added to `resolveLimits()`
with its case in `src/server/billing/__tests__/limits.test.ts` in the same stage that adds it — the
published number is the enforced number.

### Tenant isolation test

Appended as its own `describe` block, editing none of the blocks `04-S1` wrote. The case
this stage owns is the cache-key rule: a rate fetched in A's scope is served from cache to B, which
is correct and asserted as correct; and no key the module can construct contains a trip id, a member
id or any other tenant value, asserted by exercising the key builder rather than by reading it.

### Verification

**Command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests.** `src/server/repos/__tests__/rates.test.ts` (edit) — the port is consulted only after
the manual rate, the frozen rate and the cache have all missed; a provider failure yields `null` and
never a fallback number; a successful fetch is written to the cache with the TTL the provider's terms permit; a
malformed provider response is a miss rather than a throw; the key builder rejects any input that
would embed tenant data.

**Browser evidence.** `describe` block `04-S7 — live rate conversion`. Route
`/trips/$tripId/costs`, light and dark at **360px, 1280px and 2560px**, plus one declared non-resting
state: the display-currency menu open with the previously disabled options now enabled, reached by
`--click` on `[data-part="display-currency"]`, framed as `--state display-menu`. The selector is the
one `04-S1` ships and is verified with `page.locator(sel).count()` before capture.

**Console must be silent**, asserted through `watchConsole`. **No layout shift after paint**,
measured as in every other stage of this file: init-script observer, mark after `settle()`, switch
display currency, assert `0` after the mark, gated on `supportedEntryTypes` with the WebKit skip
stated.

**The harness, quoted in full**, so the port, the session refresh and the clock pin are visible
here rather than inherited from a sentence elsewhere. `2026-08-20` is `BASELINE_DAY`, and
`capture.mjs` installs its header interceptor only when `PT_SERVER_TODAY` is set
(`scripts/ultrabuild/capture.mjs:168-169`), so an unset pin shoots a different day than the gate
compares.

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)

PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/budget-and-currencies.visual.spec.ts
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/budget-and-currencies.visual.spec.ts --update-snapshots -g '04-S7'

PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/$TRIP_ID/costs" \
  --out ".claude/ultrabuild/shots/04-budget-and-currencies/round-<n>/04-S7" \
  --label B --auth \
  --viewports 360x800,1280x900,2560x1440 --themes light,dark

PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/$TRIP_ID/costs" \
  --out ".claude/ultrabuild/shots/04-budget-and-currencies/round-<n>/04-S7" \
  --label B --auth --state display-menu \
  --viewports 360x800,1280x900,2560x1440 --themes light,dark \
  --click '[data-part="display-currency"]' --settle 800
```

One click from rest, so `capture.mjs` takes it. The frame is worth taking twice — once before this
stage lands, with the currencies that need a provider disabled, and once after, with them enabled —
because the difference between those two rings is the entire visible outcome of the stage, and the
disabled set already exists as `04-S1`'s evidence.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged: build succeeds; lint and typecheck clean with no
suppressions; new logic tested and `pnpm test` passing; verified in a real browser in light and dark,
desktop and mobile; nothing left behind; no file outside **Owned paths** touched.

The §2 visual clauses are ticked against the surfaces `04-S1` shipped, because this stage ships none
of its own — and they are ticked by looking, not by inheritance:

- [ ] Spacing on the 4px grid from `--space-*` — unchanged, confirmed by the frame set.
- [ ] Hover, focus-visible, active, disabled and loading on the display-currency control, now
      exercised in its enabled state as well as its disabled one.
- [ ] Designed empty, skeleton and error states on `--color-surface-2` — unchanged.
- [ ] Motion 150–260ms on `--ease-out-quint` or a sibling, `prefers-reduced-motion: reduce` honoured
      — unchanged.
- [ ] Light and dark parity with dark shadows re-declared — unchanged.
- [ ] 360px → 2560px — unchanged, confirmed by the frame set.
- [ ] Keyboard navigable end to end, accessible names, WCAG 2.2 AA in both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.
- [ ] `tabular-nums` on every converted amount the enabled mode now renders.

### Blockers

**The whole stage is one blocker, and that is why it exists as a stage rather than as a sentence.**

A third-party foreign-exchange service, not yet chosen and not choosable here. The constraint
recorded in `11-boundaries-and-blockers.md` (`11-S3`) binds: a tier whose terms exclude a commercial,
subscription-funded product is unusable to us at any traffic level, because we charge for
subscriptions; and what the provider permits us to cache, for how long, and what attribution it
requires on screen decide the cost more than the per-call price does. Disposition: **defer** until
the decision is taken. No provider is named here, no client is written for an unnamed service, and no
package is installed — the freeze covers `package.json` and `pnpm-lock.yaml` absolutely.

Until then `04-S1`'s shipped behaviour stands on its own: the reader supplies the rate their receipt
shows, the workspace remembers the last rate used for that pair, and nothing is ever invented.

**One precondition inherited from the harness, recorded here because `12-verification-protocol.md`
§7.2 requires the stage that baselines a trip tab to carry it rather than absorb it.** Every stage in
this file baselines `/trips/$tripId/costs`, which is a trip tab, and seven call sites still construct
their own `Intl.DateTimeFormat` with `month: 'short'` — two of them in `src/components/costs/data.ts`
— which workerd and WebKit abbreviate differently. Disposition: **report**. None of those files is in
this stage's **Owned paths**, so it repairs none of them; it widens no diff budget, which §5 of the
same file forbids outright; and it attributes a `mobile-safari` difference of that shape rather than
re-recording a baseline over it. §7.3 rides with it: nothing in the repository pins the browser
revisions behind these baselines, so a green comparison proves this stage changed nothing on this
machine and is not a claim about a second one.

## Cross-plan collisions

Two stages in the same wave that both take an exclusive disposition — `edit`, `new`, `create`,
`delete` — on one file clobber each other, because the runs that execute them go in parallel.
`append` is the documented cooperative pattern and is not a collision. And a plan that cites a
sibling's stage id, or that asserts visual verification without ever invoking the harness, is wrong
in a way a reader will not notice. Both are checked with a script rather than by reading the sibling
plans, because a plan can only read the siblings that existed when it was written, and a judgement
that has to be re-made by hand every round is eventually made wrong.

Both are part of this plan's gate. A stage that executes any part of this file runs both first.

### The ownership check

```sh
node scripts/ultrabuild/check-plan-collisions.mjs 04
```

Output, pasted whole:

```
plans 13 · stages 91 · owned paths 545

4 stage(s) state no parseable wave and cannot be checked: 11-S1 11-S2 11-S3 04-S2

no same-wave exclusive collisions

touched by more than one plan in different waves (2) — legal; each plan must name the other:
  src/server/repos/expenses.ts
      00-foundations.md  00-S1  wave 0  (edit)
      04-budget-and-currencies.md  04-S1  wave 1  (edit)
      04-budget-and-currencies.md  04-S3  wave 2  (edit)
      04-budget-and-currencies.md  04-S6  wave 3  (edit)
  src/server/fns/costs.ts
      00-foundations.md  00-S2  wave 0  (edit)
      04-budget-and-currencies.md  04-S1  wave 1  (edit)
      04-budget-and-currencies.md  04-S3  wave 2  (edit)
      04-budget-and-currencies.md  04-S6  wave 3  (edit)
```

The script exits `0`.

### The reference and harness check

```sh
node scripts/ultrabuild/check-plan-refs.mjs 04
```

Output, pasted whole:

```

plan 04: 0 dangling stage reference(s), 0 plan(s) missing a Playwright invocation
```

The script exits `0`, and the blank first line is the script's own leading newline rather than a
truncation. Both numbers had to be earned.

**Zero dangling stage references.** Every `NN-Sn` token this file cites is defined by a `## Stage`
heading in the plan whose prefix it carries. One was not: an earlier draft's `04-S1` **Blockers**
attributed to `11-S3` a disposition making a fourth cron trigger for a rate refresh "report only".
`11-boundaries-and-blockers.md` contains no such disposition — `11-S3` registers three absent
bindings and three open provider decisions, and the only sentence about a cron anywhere in that file
is `11-S1`'s, about a nightly database export. The token `11-S3` resolved, so this check did not
catch it; an auditor did. The claim is now made against `wrangler.jsonc:107-114` directly, which is
where a cron trigger can actually be read, and nothing is attributed to a sibling that the sibling
does not say. **The lesson is the general one:** citing a stage id that exists is not the same as
citing a stage that says what you claim, and the second half is still a reader's job.

**Zero plans missing a Playwright invocation.** This file was the plan that check was written for. It
asserted browser evidence in all seven stages while containing no `PLAYWRIGHT_BASE_URL`, no
`capture.mjs`, no `PT_SERVER_TODAY` and no shot directory anywhere — which is
`12-verification-protocol.md` §2 and §8 items 2 and 3 unmet, and an unfalsifiable claim rather than a
plan. `## The harness every stage in this file runs` now states the two invocations once with their
measured seams, and every stage quotes its own under **Verification** with its route, its stage id
and its declared states.

### Reading it, line by line

**No same-wave exclusive collision involves this plan.** That is the result the check exists for, and
it was not free: reaching it changed four things.

- `04-S2` no longer names `src/server/do/protocol.ts`. The check found `07-S1`
  (`07-collaboration-and-sharing.md`) holding that module exclusively **in the same wave**, and two
  stages adding an entity kind to one module in parallel corrupt each other. `04-S2` now mirrors
  category writes under the existing `trip` entity kind, on the precedent at
  `src/server/fns/costs.ts:478-480`, and declares no kind at all.
- `04-S5` no longer puts a module in `src/components/costs/`. `04-S4`, in the same wave, holds
  `src/components/costs/index.ts` — the barrel every consumer of that directory imports through — so
  a new module there would either have been unreachable or would have needed a second claim on the
  barrel. The dialog is route-local instead, at
  `src/routes/_app/trips/$tripId/-costs/currency-rebase-dialog.tsx`, and has exactly one caller.
- **`04-S2` no longer claims a write path it cannot own**, which is the repair this round made and
  the one the check pointed straight at. `expenses.cost_category_id` can be written from exactly two
  modules, `src/server/repos/expenses.ts` and `src/server/fns/costs.ts`, and the output above puts
  `04-S1` on both **in wave 1** — the same wave as `04-S2`. A second exclusive claim there would have
  been the collision this section reports the absence of; instead `04-S2` defers that one behaviour
  to `04-S3`, which is wave 2, already owns both modules, and already carried the isolation cases and
  the resolver assertion for it. `MNY-01` is still closed by exactly one stage, `04-S2`, with the
  deferral written into its **Reference rows** — the shape `04-S1` already uses for `MNY-07`. The
  repair also added two owned paths to `04-S2`, `-costs/category-model.ts` and its test under
  `-costs/__tests__/`, so the resolver `04-S2` ships is covered by a test `04-S2` owns rather than by
  `04-S3`'s a wave later; neither path is claimed by any other stage in any plan.
- **Every stage now names `e2e/__screenshots__/budget-and-currencies.visual.spec.ts/`, not only
  `04-S1`.** An earlier draft listed the baseline directory once, in the stage that creates it, while
  the other six each ran `--update-snapshots` for their own `describe` block —
  `playwright.config.ts:49-50` derives that directory from the spec's file name, so all six wrote
  PNGs into a path they had not declared, which is `docs/SPEC.md` §7 item 6 broken six times over.
  `04-S1` holds it `new` and `04-S2` through `04-S7` hold it `append`, which the check accepts
  because `append` is cooperative: the six do not appear in the collision list, and their frame names
  begin with the stage id so none can overwrite another's PNG.

**Both cross-wave paths are named in their owning stages, with the sibling stage id**, which is what
the rule asks for:

- `src/server/repos/expenses.ts` — held by `00-S1` in wave 0 and named as such under **Owned paths**
  in `04-S1`, `04-S3` and `04-S6`. `00-S1` closes before wave 1 opens, so every stage in this file
  starts from its landed edit rather than from HEAD.
- `src/server/fns/costs.ts` — held by `00-S2` in wave 0, named the same way in the same three stages.

**No stage of this file is in the wave-less list any more, and that was a repair rather than a
coincidence.** An earlier draft left `04-S7` with no wave on the grounds that it is gated on a
decision outside this plan. The check reported it as uncheckable, which mattered: `04-S7` takes
`src/server/repos/rates.ts` and its test exclusively, and an exclusive claim nobody can check is the
exact shape the rule exists to catch. `04-S7` now states **wave 6** — a floor, since everything it
enables sits in waves 1 to 3, not a release date, since the `11-S3` decision still gates it — and the
check now places its two claims four waves after `04-S1`'s, which is cross-wave and legal.

The four lines that remain are all outside this file's ownership. `11-S1`, `11-S2` and `11-S3` belong
to the register plan. The `04-S2` in that list is **not** this file's `04-S2`, which states `Wave 1`
and parses: it is the illustrative `## Stage 04-S2` heading inside the code fence at
`12-verification-protocol.md:26`, which the script reads as a stage because it cannot tell a fenced
example from a real heading. Every stage of this file states its wave in its `### Stage id` line, in
the form the script parses:

| Stage   | Wave | Effort |
| ------- | ---- | ------ |
| `04-S1` | 1    | L      |
| `04-S2` | 1    | L      |
| `04-S3` | 2    | M      |
| `04-S4` | 2    | M      |
| `04-S5` | 2    | M      |
| `04-S6` | 3    | M      |
| `04-S7` | 6    | S      |

**One thing the output cannot tell anyone, said here instead.** The header counts are a snapshot of a
set several runs are still writing: it read `plans 7 · stages 37 · owned paths 204` two rounds ago,
then `282`, `283` and `284` across three invocations minutes apart, then `553`, and it reads
`plans 13 · stages 91 · owned paths 545` above — the six baseline-directory claims added here, and a
sibling plan's own repairs taken away, inside one round. Every remaining area plan landed in between
and sibling plans were dirty in the working tree the whole time; it read `544` at the start of the
round the currency repairs landed in and `543` at the end of it, while **this file's own owned paths
parsed as 69 in both, the identical set** — measured by parsing the `### Owned paths` blocks out of
this file at `HEAD` and in the working tree and diffing them, not assumed from the fact that no
bullet was retyped. The round after that one took this file to **71**, by adding the two `04-S2`
paths named above and changing no other bullet; the output pasted at the top of this section is the
one recorded after they were added, and the header moved by two with them. So the header will not
reproduce exactly, it moves for reasons that are not this
file's, and it is not the part that matters.

The findings under it are properties of **this** file's ownership — nothing this plan claims
exclusively is claimed by a sibling in the same wave, the two paths it shares across waves are named
in the stages that own them, no stage of this file is invisible to the check, no stage records a
baseline into a directory it has not declared, every stage id it cites is defined by the plan whose
prefix it carries, and every stage quotes the harness invocation it runs. Those hold until a sibling
changes what it claims. The stage that executes any part of this file re-runs **both** scripts first,
reads the same things, and treats a new same-wave line, a new dangling reference or a lost Playwright
invocation as a blocker rather than a note. That re-run is part of this plan's gate, not an optional
courtesy.
