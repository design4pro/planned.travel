# Change a trip's accounting currency without moving any money

| Field              | Value                                          |
| ------------------ | ---------------------------------------------- |
| **Status**         | ready                                          |
| **Issue**          | none                                           |
| **Spec PR**        | none                                           |
| **Implementation** | none                                           |
| **Plan**           | 04-S5 (docs/plans/04-budget-and-currencies.md) |

## 📝 TLDR

Plan stage `04-S5` closes reference row `MNY-06`: a trip's **accounting currency** (`trips.currency`,
the currency every share, balance, total and settlement of the trip is denominated in) can be
changed safely. A safe change is a **re-basing**, not a relabel: every figure denominated in the old
currency is converted once, at one rate the owner has seen and confirmed, while the amount each
traveller typed stays readable in the source columns.

The plan says nothing can change `trips.currency` after creation. That is false at HEAD
(`b4025bb7`): the trip edit sheet already sends it and `updateTrip` writes it, so an owner can
relabel a trip today and every expense, share, payment and the budget target silently change
currency with their numbers untouched. This spec therefore starts by closing that door, then builds
the one writer that may open it: `changeTripCurrency`, a previewed, owner-only, single-batch
operation, with an entry point in the Costs header. Six slices, the first two of which need nothing
from the still-unspecified `04-S1`.

This spec describes the work that is **left** at HEAD and departs from the plan's stage block in the
places where the plan predates the code, an ADR or a specialist's read. Each departure is a row of
the Resolved assumptions table.

## 📝 Problem Statement

What exists (`MNY-06` is `partial`):

- `trips.currency` (`schema.ts`, `NOT NULL DEFAULT 'EUR'`), chosen at creation.
- `expenses`, `settlements` carry `amount_minor` + `currency` and the source triple
  (`original_amount_minor`, `original_currency`, `exchange_rate`). `expense_shares` carries
  `share_minor` and `weight`. `places`, `reservations`, `transports`, `day_accommodations` carry a
  price and a **nullable** `currency`. `trips.budget_target_minor` is a figure in the trip's
  currency with no currency column.
- **A bare relabel is reachable.** `tripFields.currency` (`src/server/repos/trips.ts:141`) is part of
  `updateTripInput`; `updateTripInputSchema` (`src/routes/_app/-server/trip-lifecycle.ts:180-189`)
  accepts it; `TripFormFields` renders the select (`-ui/trip-form.tsx:197-207`) and `TripEditSheet`
  (`-ui/trip-actions.tsx`) sends it on every save. Nothing re-bases anything.

What is missing:

- No way to change the currency that keeps the books true.
- No `budget_items` source columns, so a planned figure cannot be re-based without rewriting what the
  traveller typed.
- `convertMinor()`, `resolveRate()` and `src/server/repos/rates.ts` (plan stage `04-S1`) do not exist
  yet, and `04-S1`, `04-S2`, `04-S3` have no spec at this commit.

Why it matters: a currency change is the traveller correcting "I picked EUR but we are paying in
JPY". Done as a relabel, 12,400 JPY becomes 12,400 EUR with no error anywhere; done as a re-basing
the same dinner reads 74.20 EUR and every balance stays what it was worth. The failure is silent and
shows weeks later as a debt that is wrong by the exchange rate.

## 📝 Proposed Solution

### What the stage owns and what it does not

Owns: the refusal of a bare currency edit; the guard that stops a stale tab writing money in the old
currency; the re-basing (preview and commit) and its repository; the Costs-header entry point and
dialog; the read-only currency in the trip edit sheet.

Does not own: `convertMinor`, `resolveRate`, `rates.ts` and the frozen-rate lookup (`04-S1`, quoted
below); the expense dialog, ledger list and writers' UI (`04-S3`); charts (`04-S4`); settlement
suggestions (`04-S6`); a rate provider (`04-S7`).

### The contract consumed from `04-S1` (its spec wins if it diverges)

Quoted from `docs/plans/04-budget-and-currencies.md` § `04-S1`, not invented here:

- `convertMinor(minor, rate, from, to): number` in `src/lib/money.ts`; `rate` is major-per-major
  (`1 from = rate to`), the result applies the digit difference and rounds half-up exactly once;
  `convertMinor(x, 1, c, c)` is the identity.
- `resolveRate(scope, { from, to, on, manual? }): Promise<{ rate: number, source: 'manual' | 'recent' | … } | null>`
  in `src/server/repos/rates.ts`. It never invents a rate and returns `null` when nothing answers.
  The `RateSource` port has no implementation until `04-S7`; this stage must not assume a provider.

Phases 3 to 5 are blocked by the `04-S1` ticket. Phases 1, 2 and 6 are not.

### The rules (what each prevents)

1. **Pin before you move.** A row that inherited the trip's currency gets its source triple filled
   from itself (`original_amount_minor = amount_minor`, `original_currency = old`,
   `exchange_rate = 1`) in the same statement that converts it. Otherwise the typed figure is lost.
2. **Amount and code move together.** One `UPDATE` per row writes `amount_minor`, `currency` and the
   source triple at once. A row is never left with the new amount and the old code.
3. **One rate, once.** `k` (`1 old = k new`) is fixed by the owner in the preview and sent with the
   commit; the commit does not look a rate up. Every row uses that `k`.
4. **Converting a row.** Let the row's source be `(orig, origCur, r)`, pinned as above for an
   inherited row (`r = 1`). If `origCur === new`: `amount = orig`, `rate = 1` (the traveller's figure
   is the truth; no rounding drift). Otherwise `amount = convertMinor(orig, r × k, origCur, new)` and
   `exchange_rate = r × k`. A source amount of zero converts to zero and keeps its stored rate.
5. **Rows already in another currency.** A ledger row whose `currency` is neither `old` nor `new` (a
   booking priced in yen synced into the ledger without a source triple, `fns/reservations.ts:309-337`)
   has no rate to `new` that `k` supplies. The re-basing is **refused** with the count, never guessed.
   A row whose `currency === new` is kept as typed (`orig = amount`, `rate = 1`).
6. **Shares are recomputed through the one splitter.** For every expense with share rows, new shares
   come from `computeShares` (`src/server/repos/expenses.ts`), imported, not copied: for `equal`,
   `shares` and `percentage` rows, with the stored `weight` of each participant under the row's own
   method; for `exact` rows, as method `shares` with each participant's **old `share_minor`** as the
   weight (the stored weight of an exact row is 1, so using it would turn the split into an equal one).
   Remainder units go in participant order, exactly as `computeShares` does it. A new amount of zero
   gives zero shares. The sum equals the new `amount_minor`; `is_settled`, `weight` and `split_method`
   are untouched.
7. **Reference prices are pinned, not converted.** `places`, `reservations`, `transports`,
   `day_accommodations` rows with `price_minor IS NOT NULL AND currency IS NULL` get
   `currency = old`. Their `NULL` meant "the trip's currency" on every screen, so leaving them would
   relabel them. They are never netted into a balance and never converted.
8. **The budget target** (`trips.budget_target_minor`) is converted with the same `k` through
   `convertMinor`. It has no source columns, so a round trip old → new → old may differ from the
   starting figure by rounding on this one number; the preview shows the old and new figure.
9. **Only the owner, only on a writable trip.** `requireWritableTrip` first (a non-member learns
   nothing; an archived trip is refused), then `assertTripRole(scope, tripId, ['owner'])`. An editor
   or viewer gets `FORBIDDEN`. Both preview and commit are guarded.

### Rounding is honest, not hidden

Each converted row rounds once, so a member's balance can move by up to one minor unit **per row**
the member appears in, not one per member (the plan's claim). A trip settled to exactly zero before
the change can therefore show a leftover of a few minor units after it. The plan's "a settled trip
stays settled" is dropped as a guarantee and replaced by disclosure: the preview computes the
balances before and after in memory and shows (a) the largest per-member movement against
`round(k × balance)` and (b) when everybody is at zero now and somebody would not be after, each
person and the leftover amount in money ("Ana would owe Ben 0.01 EUR"). Dust handling in
`suggestSettlements` belongs to no stage and would hide real one-unit debts, so it stays out; a
leftover can be settled with an ordinary payment.

### Atomicity and the stale-read race

All work is **one `runBatch`** (`src/server/repos/batch.ts`), which on D1 is a single atomic
`db.batch()`. Three things make "a half-re-based trip is not a reachable state" true, not hoped for:

1. **Statement budget.** The batch is: one `UPDATE` per expense, per settlement and per budget item;
   one `CASE`-keyed `UPDATE` of `expense_shares` per split expense (two bound parameters per
   participant, so a row of more than about 40 participants takes a second statement, using
   `chunkFor`); four set-based pin statements (places, reservations, transports, stays); and the
   final `trips` statement. A single function `countRebaseStatements(plan)` is used by the preview
   and by the commit; the constant `MAX_REBASE_STATEMENTS = 900` is enforced by the commit
   **again** before it builds the batch (the preview figure is advisory). In traveller terms that
   admits a trip of roughly **400 logged expenses and payments together**, however many people share
   them (about two statements per split expense). Above the ceiling nothing is written and the
   dialog says the trip is too large to change in one step. No chunking: a chunked re-basing is not
   atomic. The number assumes Cloudflare's paid-plan D1 limit of 1,000 queries per Worker invocation
   (every statement of a batch counts), which the repository does not state anywhere and this spec
   could not verify offline: Phase 4's implementer cites the current Cloudflare D1 limits page in the
   constant's comment and lowers the constant if it says less. It is an exception to
   `docs/SPEC.md` §5 ("keep D1 transactions small") taken deliberately, because the alternative is a
   non-atomic money rewrite; it is bounded by the ceiling and by this being a rare, owner-only act.
2. **Fixed read cost.** The pre-reads are one query per table filtered by `trip_id`
   (`expenses`, `expense_shares`, `settlements`, `budget_items`, the trip row), never the
   per-expense `getExpenseWithShares` pattern `loadCosts` uses.
3. **The batch rolls back if anything moved since the read.** Every per-row `UPDATE` is predicated on
   the values read (`WHERE id = ? AND amount_minor = ? AND currency = ?`, plus the tenant and trip
   predicates through `tenantFilter`). The **last** statement is
   `UPDATE trips SET currency = CASE WHEN <stale> THEN NULL ELSE ? END, budget_target_minor = ? …
WHERE id = ? AND currency = old`, where `<stale>` is true when any expense, settlement or budget
   item of the trip still has a `currency` other than `new`, or any split expense's shares do not sum
   to its `amount_minor`. `trips.currency` is `NOT NULL`, so a stale trip raises a constraint
   failure and D1 rolls the whole batch back; nothing is checked after commit, because by then the
   corruption has landed. The commit maps that failure to a typed refusal ("the trip changed while
   you were confirming; nothing was changed").

### The writer that may change `trips.currency`

`changeTripCurrency(scope, tripId, { to, rate })` in `src/server/repos/trip-currency.ts` is the only
writer of `trips.currency` after creation. A trip with nothing to convert (no ledger row, no budget
item, no budget target, no priced reference row) takes the same path with no rate: the plan's
zero-count case, and the way an owner fixes a currency picked by mistake on a new trip.

### Stale writers

A tab that loaded Costs before a re-basing must not write money in the old currency. The three
client-originated money writers in `src/server/repos/expenses.ts` (`createExpense`, `updateExpense`,
`createSettlement`) accept an optional `expectedTripCurrency`; when present and different from the
trip's current currency they throw `TripCurrencyChangedError` before any insert (and before
`writeShares`), nothing written. `updateExpense` resolves the trip from the stored row. The guard is
keyed on the **client's belief about the trip**, not on the row's own `currency`, because booking
sync legitimately writes a booking's own currency (`fns/reservations.ts:312`) and passes no
assertion (it is server-derived and cannot be stale). `createExpenseFn` / `updateExpenseFn` pass
`body.currency`, which the expense dialog already sends; `recordPaymentSchema` gains an optional
`currency` that the payment dialog sends and `recordPaymentFn` forwards instead of reading
`trip.currency`. A missing value keeps today's behaviour for one release (`BACKWARD_COMPATIBILITY.md`
§2) and becoming required is a follow-up. A residual race stays and is named: the check and the
write are two statements, so a write that interleaves with a re-basing batch is caught by the
batch's own stale check (rule above) when it lands first, and by this guard when it lands after.

### Alternatives considered, and why they lost

- **Self-contained stage with its own `convertMinor` and rate resolver.** Two owners for one concept
  (`docs/SPEC.md` §8) and two stages editing the same new modules. Rejected for the quoted contract.
- **Only close the relabel and defer the re-basing.** Leaves `MNY-06` unspecified while the pipeline
  is writing specs; kept as Phase 1, not as the whole stage.
- **Remove `currency` from `updateTripInputSchema`.** The schema is strict and the sheet sends the
  field on every save, so a tab on the previous bundle would fail even a rename
  (`BACKWARD_COMPATIBILITY.md` §2). The field stays accepted; an unchanged value is a no-op and a
  different one is refused.
- **Chunk the batch or move it to a queue.** Reintroduces the half-re-based state (and a queue
  consumer faces the same per-invocation limit). Rejected for a named ceiling.
- **Clear or keep the budget target.** Clearing loses a figure with no screen to set it again
  (nothing but the dev seed writes it); keeping it is the mislabelling this stage prevents.

## 📝 Architecture

- **Owner of each new concept** (`docs/SPEC.md` §8): the re-basing (planning, preview, commit,
  statement count, stale guard) — `src/server/repos/trip-currency.ts`; the two server functions —
  `src/server/fns/trip-currency.ts`; the refusal of a bare currency edit — `updateTrip` in
  `src/server/repos/trips.ts` (it owns `trips.currency` writes); the stale-writer helper
  `assertExpectedTripCurrency` — `trip-currency.ts`, imported by `expenses.ts`; the dialog —
  `-costs/currency-rebase-dialog.tsx`, route-local, imported relatively by `-costs/screen.tsx` (one
  caller, and `src/components/costs/index.ts` is held by `04-S4`).
- **Pure core, thin shell.** `planRebase(snapshot, { old, to, rate })` is a pure function over rows
  read once and returns the new rows, the counts, the statement count, the budget target and the
  balances before and after. Preview and commit both call it, so what the owner confirms is what is
  written. `netBalances(rows)` is pure too; a parity test pins it to `getMemberBalances` on the same
  fixture so the balance formula has one definition in behaviour.
- **Seams.** SQL only in `server/repos`; every statement through `tenantFilter(scope, table,
eq(table.tripId, tripId), …)` (the `deleteTrip` precedent at `trips.ts:879-887`), so a bulk
  `UPDATE` never loses its tenant or trip predicate. `components/costs` and `components/ui` import
  nothing from `server/`. The dialog calls the functions through `useServerFn` from the route layer.
- **Errors.** `CurrencyLockedError` (bare relabel), `TripCurrencyChangedError` (stale writer),
  `RebaseRefusedError` (no rate, unconverted rows, too large, changed while confirming) are listed in
  `AUTHORED_ERROR_NAMES` (`src/server/errors/public.ts`) with the test that enumerates it. Their
  messages are authored English refusals, like `TripRoleError`; the **preview** returns its refusals
  as structured data (`{ kind: 'no-rate' | 'unconverted-rows' | 'too-large', … }`) so the dialog
  renders them from the 23-locale catalogue. Translating authored errors is an existing platform gap,
  not this stage's.
- **Audit and room.** After a successful commit the function calls `trail()` with a new
  `AUDIT_ACTIONS.TRIP_CURRENCY_CHANGED = 'trip.currency_changed'` (`src/server/audit/trail.ts`),
  metadata `{ from, to, rate, expenses, settlements, budgetItems }`, and mirrors
  `patch('trip', id, { currency, budgetTargetMinor, expensesChangedAt })` to the trip room. No new
  patch kind; `src/server/do/protocol.ts` is untouched.
- **No quota.** It updates rows and creates none: nothing in `resolveLimits()` / `PLAN_QUOTAS`.
- **No new route**: no `pnpm generate-routes`.

## 📝 Data Model

One additive migration, generated by `pnpm db:generate` and never hand-edited: `budget_items` gains
`original_amount_minor integer`, `original_currency text(3)`, `exchange_rate real`, all nullable, no
default, no `CHECK`, no index (a `CHECK` change rebuilds a table on SQLite; the non-negative guard
and the all-three-or-none rule live in the repository's Zod, as for `settlements`). `NULL` reads as
"no conversion happened, implied rate 1"; only a re-basing fills the columns, and no other budget-item
writer changes. The previous Worker reads none of them, so a rollback is safe.

Everything else the stage touches already exists. No backfill.

## 📝 API Contracts

- `previewCurrencyChangeFn` (`GET`) input `z.strictObject({ tripId, to: currencySchema, rate:
z.number().finite().min(1e-7).max(1e7).optional() })` with a refinement `to !== trip.currency`.
  Output: `{ from, to, rate: { value, source } | null, counts: { expenses, settlements, budgetItems,
shareRows, pinnedPrices }, example: { original, converted } | null, budgetTarget: { before, after
} | null, balances: { maxMovementMinor, leftovers: Array<{ userId, otherUserId, amountMinor }> },
statements, ceiling, refusal: null | { kind, … } }`. With no `rate` it asks `resolveRate` (manual
  absent); with a `rate` it uses it as `manual`.
- `changeTripCurrencyFn` (`POST`) input `z.strictObject({ tripId, to, rate: <the same bounded
number>.optional() })`; `rate` is required unless the plan has nothing to convert. Output: the
  counts it actually wrote. An extra key (say `expenseIds`) is a parse error.
- Bounds: every converted amount must be a safe integer, else `RebaseRefusedError`; the rate bounds
  keep VND ↔ KWD in range.
- Edited contracts: `createExpenseInput`, `updateExpenseInput`, `createSettlementInput` gain
  `expectedTripCurrency?`; `recordPaymentSchema` gains `currency?`; `updateTrip` refuses a different
  `currency`.

## 📝 UI/UX

- **Entry point.** A `Change currency` button in `TripModuleHeader` `actions` on Costs
  (`-costs/screen.tsx`), next to Export / Settle up / Add expense, **shown to the owner only**
  (role of `viewerUserId` in `data.people`); the server refusal is what counts. It carries
  `data-part="trip-currency-change"`. (The plan placed it in `costs-toolbar.tsx`, which is the
  expense filter bar.)
- **The dialog is a confirmation with arithmetic in it.** Currency `Select` (the shared currency
  options, minus the current one); the rate with where it came from ("last rate used in this
  workspace, 12 Sep" / "the rate you entered"); a field to type a different rate; the counts; one
  worked example — "12,400 JPY stays 12,400 JPY and now adds up as 74.20 EUR"; the budget-target
  line; the rounding line and any leftover; then `Change to EUR` / `Cancel`. It is a full-height
  sheet on small screens (the `Dialog` primitive), focus trapped and restored by the primitive.
- **States.** Skeleton while the preview loads (lines sized to the result, confirm disabled until it
  lands). No rate on record: the rate field is required and empty, with the sentence saying so; the
  preview re-runs on blur. Unconverted rows: a refusal naming the count, confirm disabled. Too
  large: a refusal naming the size and the limit, "nothing was changed". Preview or commit failure:
  `Alert` on `--color-surface-2`, confirm disabled, a retry, "nothing was changed". Nothing to
  convert: "Nothing on this trip is priced yet, so nothing needs converting" and the confirm is
  enabled. Committing: confirm `loading`, `Select` and rate `disabled`. Success: the dialog closes,
  `router.invalidate()`, a toast "The trip now adds up in EUR".
- **Edit sheet** (Phase 6, after PR #779 merges): the currency renders as read-only text with "To
  change the currency, use Change currency on the Costs tab" and a link to the tab; the form
  stops offering the select on edit. Creation is unchanged.
- Tokens: `--space-*`, `--radius-xl`, `--shadow-modal`; `tabular-nums` on the rate, the counts and
  every figure; motion is the primitive's own and honours `prefers-reduced-motion`.

## 📝 Visual change expected

- `/trips/$tripId/costs`: a new `Change currency` header button (owner only), light and dark,
  360 / 1280 / 2560 px. The dialog in: preview loaded with the example; no-rate; refusal
  (unconverted rows, too large); error with retry; nothing to convert; committing. Light and dark,
  desktop and mobile (full-height sheet).
- The trip edit sheet (Phase 6): the currency row read-only with its pointer, light and dark, desktop
  and mobile.
- No other route changes.

## 📝 Copy

New keys in `src/lib/i18n/messages/en/costs.ts` (plural forms through the catalogue's plural
mechanism for every count), each in all 23 locales per the `i18n-messages` skill. Money and rates
come from `formatMoney` / `formatRate`, never from a message.

| Key                             | `en` text                                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `rebase.open`                   | `Change currency`                                                                                               |
| `rebase.title`                  | `Change the trip's currency`                                                                                    |
| `rebase.description`            | `Every amount keeps the figure and currency it was entered in. Only the currency this trip adds up in changes.` |
| `rebase.to`                     | `New currency`                                                                                                  |
| `rebase.rate`                   | `Rate: 1 {from} = {to}`                                                                                         |
| `rebase.source.recent`          | `The last rate used in this workspace, {date}`                                                                  |
| `rebase.source.manual`          | `The rate you entered`                                                                                          |
| `rebase.noRate`                 | `There is no rate on record for {from} to {to}. Enter the rate you want to use.`                                |
| `rebase.example`                | `{original} stays {original}, and now adds up as {converted}.`                                                  |
| `rebase.counts`                 | `{expenses} expenses, {payments} payments and {planned} planned items will be converted.`                       |
| `rebase.target`                 | `The trip budget {before} becomes {after}.`                                                                     |
| `rebase.rounding`               | `Each amount is rounded once, so a balance can move by up to {amount}.`                                         |
| `rebase.leftover`               | `After the change, {name} would owe {other} {amount}.`                                                          |
| `rebase.nothing`                | `Nothing on this trip is priced yet, so nothing needs converting.`                                              |
| `rebase.unconverted`            | `{count} entries are in a currency other than {from} and have no recorded conversion. Nothing was changed.`     |
| `rebase.tooLarge`               | `This trip has too many entries to change in one step ({count}, the limit is {limit}). Nothing was changed.`    |
| `rebase.error`                  | `Nothing was changed. Try again.`                                                                               |
| `rebase.confirm`                | `Change to {to}`                                                                                                |
| `rebase.done`                   | `The trip now adds up in {to}.`                                                                                 |
| `shell.editTrip.currencyLocked` | `To change the currency, use Change currency on the Costs tab.`                                                 |

`ui.action.cancel` and the retry label are reused.

## 📝 Edge Cases & Failure Scenarios

| Case                                                                | Behaviour                                                                                                                                                                |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Same currency as now                                                | Refused by the input refinement; the select omits it.                                                                                                                    |
| No rate on record and none typed                                    | Preview `refusal: 'no-rate'`; nothing is invented; confirm disabled.                                                                                                     |
| Rate outside `[1e-7, 1e7]` or a converted amount not a safe integer | Refused, nothing written.                                                                                                                                                |
| Row in a third currency, no triple (booking sync)                   | Refused with the count (rule 5); a row already in `new` is kept as typed.                                                                                                |
| Foreign receipt whose `original_currency` is the new base           | `amount = orig`, `rate = 1`; the typed figure is exact.                                                                                                                  |
| `exact` split                                                       | Shares distributed over the new amount in proportion to old `share_minor` (rule 6).                                                                                      |
| Zero amount                                                         | Zero amount, zero shares; stored rate unchanged.                                                                                                                         |
| Trip with nothing to convert                                        | Same path, no rate needed; only `trips.currency` moves.                                                                                                                  |
| Above the statement ceiling                                         | Refused in preview and again in commit; nothing written.                                                                                                                 |
| Row changes between preview and commit                              | Predicated `UPDATE` plus the final stale check roll the batch back; "changed while confirming".                                                                          |
| Editor, viewer, non-member, archived trip                           | `FORBIDDEN` / `NotFoundError` / `TripArchivedError`; nothing written.                                                                                                    |
| A stale tab saves an expense or payment after the change            | `TripCurrencyChangedError`; the tab is told to reload.                                                                                                                   |
| Old tab or API client sends the unchanged `currency` on a trip edit | A no-op; a different one is refused with `CurrencyLockedError`.                                                                                                          |
| Re-basing JPY → EUR → JPY                                           | Every row with a source triple returns to its typed figure; the budget target may differ by rounding.                                                                    |
| Booking later re-synced into its expense                            | The booking's price was pinned to `old` (rule 7), so the synced line is honestly in `old` and stays visible as a foreign line; converting such lines is another stage's. |

## 📝 Observability

The commit writes one audit entry (`trip.currency_changed`) and the existing server-function logging
applies. A failed batch is logged by the function's error path with the trip id and counts, never
with amounts.

## ✅ Acceptance criteria

1. `updateTrip` with a `currency` different from the stored one throws `CurrencyLockedError` before
   any write; the same value is a no-op; `trips.currency` has exactly one writer after creation,
   `changeTripCurrency`.
2. After any re-basing: no expense, settlement or budget item of the trip has a `currency` other than
   `new`, and every row's `amount_minor` equals the conversion of its own source triple (or its typed
   figure when `origCur === new`).
3. Every expense's shares sum exactly to its new `amount_minor`; `is_settled`, `weight`,
   `split_method` survive; an `exact` split stays proportional to its old shares.
4. A row's typed figure is unchanged in `original_amount_minor`; JPY → EUR → JPY returns every row
   (the budget target excepted) to its starting figures.
5. Each member's balance moves by at most one minor unit per row they appear in (the test asserts
   that bound, not exact zero); the preview reports the largest movement and every leftover on a
   previously zero ledger.
6. An unresolvable rate, an unconverted row, a safe-integer overflow and a trip over the ceiling each
   write nothing, in the preview and in the commit.
7. A write injected between the read and the commit makes the batch roll back and leaves the trip
   byte-identical.
8. Owner only; editor, viewer, non-member, archived all refused with nothing written. Preview is
   guarded the same way.
9. A stale `expectedTripCurrency` makes `createExpense`, `updateExpense`, `createSettlement` write no
   expense, share or settlement row; booking sync still writes foreign-currency lines.
10. The dialog renders every state in "UI/UX", keyboard-operable, focus trapped and restored, no
    layout shift after the preview lands, silent console; the button is absent for non-owners.
11. Every new string exists in all 23 locales; the parity test is green.
12. `trip.currency_changed` is audited and a `trip` patch reaches the room.

## 📝 Risks & Impact Review

| Risk                                                                                      | Severity | Mitigation                                                                                                                                                            |
| ----------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bulk `UPDATE` missing its tenant or trip predicate rewrites other trips' money            | High     | Every statement via `tenantFilter(…, eq(tripId))`; isolation test compares a second trip in the same workspace and workspace B's whole money footprint byte for byte. |
| Half-re-based trip                                                                        | High     | One atomic batch, predicated updates, final stale check that raises; tested with an injected write and an injected failing last statement.                            |
| `04-S1` has no spec; Phases 3–5 wait for it                                               | Medium   | Hard dependency, quoted contract, `Blocked by` on the tickets; Phases 1, 2, 6 ship alone and are useful.                                                              |
| Phase 1 means an owner cannot fix a wrong currency until Phase 4 ships                    | Medium   | Stated plainly; accepted for safety; reversible; the zero-row path of `changeTripCurrency` is the fix for new trips.                                                  |
| D1 per-invocation limit unverified offline                                                | Medium   | Constant cites the Cloudflare page, implementer lowers it if the page says less; ceiling enforced twice.                                                              |
| Phantom one-unit debts after a settled trip is re-based                                   | Medium   | Disclosed in the preview before confirming; no hidden fix.                                                                                                            |
| PR #779 (open) edits `trip-form.tsx`, `trip-actions.tsx`, `trips.ts`, `trip-lifecycle.ts` | Medium   | Phase 6 waits for it; Phase 1 touches only `trips.ts` `updateTrip` and rebases on develop.                                                                            |
| Bookings re-synced after the change write a foreign-currency line                         | Low      | Honest label; pre-existing "converting is another stage's"; reported, not fixed.                                                                                      |

### Out of scope, noticed on the way (follow-up issues, not built here)

- `updateExpenseFn` / `deleteExpenseFn` check `data.tripId` but act on `data.expenseId` without
  checking the expense belongs to that trip (`src/server/fns/costs.ts:482-504`), so a member of one
  trip with an expense id can edit or delete an expense on another trip of the workspace.
- No money writer calls `assertTripRole`, so a viewer can log, edit and delete expenses and record
  payments, against `CONTEXT.md` ("a viewer reads").
- `getTripSpendSummary` sums `amount_minor` across currencies, so a booking-synced yen line is added
  into a EUR total.
- The Reconciler treats `04-S1`, `04-S2`, `04-S3` as covered by incidental mentions in unrelated
  issues, so their specs may never be written.
- Converting booking-synced foreign lines (rule 5) and removing `currency` from the boundary schema
  one release after the sheet stops sending it.

## 📋 Phasing

| Phase | Slice                                              | Demoable on its own                                                                                       | Needs `04-S1`   |
| ----- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------- |
| 1     | Close the bare relabel                             | Saving a different currency in the edit sheet is refused with a clear message; nothing changes            | no              |
| 2     | A stale tab cannot write money in the old currency | A save from a tab loaded before a currency change is refused with "reload"                                | no              |
| 3     | Preview what a re-basing would do                  | A server function returns counts, example, target and balance disclosure for a trip, or a refusal         | yes             |
| 4     | Commit the re-basing atomically                    | An owner's call re-bases a trip: all rows, shares, target, audit, room; or nothing                        | yes             |
| 5     | The dialog in Costs                                | The owner clicks Change currency, sees the arithmetic, confirms, and the screen reads in the new currency | yes             |
| 6     | The edit sheet shows the currency read-only        | The sheet explains where the currency is changed                                                          | no (after #779) |

Six tickets for `afk-to-tickets`; each is a vertical slice and can merge alone. Phase 1 and 2 are
independent of each other. The `budget_items` migration rides with Phase 3, where it is first read.

## 📋 Implementation Plan

### Phase 1 — Close the bare relabel

1. Write failing tests first: `updateTrip` with a different `currency` throws `CurrencyLockedError`
   and writes nothing (trip row byte-identical); with the same value it succeeds and changes nothing
   else; `updateTripInputSchema` still accepts `currency`.
2. `src/server/repos/trips.ts`: in `updateTrip`, after `requireOwnedTrip`, drop an unchanged
   `currency` from the patch and throw `CurrencyLockedError` for a different one, before any write.
   Define the error beside `TripRoleError`, add it to `AUTHORED_ERROR_NAMES` and its enumerating test
   (`src/server/errors/__tests__/public.test.ts`).
3. Add `CONTEXT.md` entries for **Accounting currency** and **Re-basing**, and make "frozen exchange
   rate" in **Budget entry / expense** say it is re-anchored by a re-basing.
4. Docs grep: `trips.currency`, `updateTrip`, `MNY-06`, `accounting currency`, `currency` in
   `docs/`, `.ai/`, `CONTEXT.md`.

### Phase 2 — A stale tab cannot write money in the old currency

1. Tests first: each of `createExpense`, `updateExpense`, `createSettlement` with a mismatching
   `expectedTripCurrency` throws `TripCurrencyChangedError` and writes no expense, share or
   settlement row; with a matching or absent value behaves as today; booking sync (no assertion)
   still writes a foreign-currency line.
2. `trip-currency.ts` (new, helper only for now): `assertExpectedTripCurrency(trip, expected)`;
   `expenses.ts` calls it in the three writers (`updateExpense` loads the trip from
   `existing.tripId`). Error added to `AUTHORED_ERROR_NAMES`.
3. `costs.ts`: `createExpenseFn` / `updateExpenseFn` pass `body.currency`; `recordPaymentSchema` gains
   optional `currency`, `recordPaymentFn` forwards it; `payment-dialog.tsx` sends the loaded
   currency. Grep every other caller of the three writers (seed, copy a trip, imports) and confirm
   none passes the new field.
4. A client message path: the existing error toast shows the authored "reload" text.

### Phase 3 — Preview what a re-basing would do (blocked by `04-S1`)

1. Schema: `budget_items` source triple; `pnpm db:generate`; the migration test.
2. Tests first for `planRebase` and `netBalances` (pure): rules 1–8 on a fixture mixing an inherited
   row, a foreign receipt, a receipt already in the new base, a zero-decimal currency, an `exact`
   split, a zero amount; the statement count; the balance disclosure; parity of `netBalances` with
   `getMemberBalances`.
3. `previewCurrencyChange(scope, tripId, { to, rate? })`: guards (rule 9), the fixed-cost reads,
   `resolveRate`, `planRebase`; returns the structured result or refusal.
4. `previewCurrencyChangeFn` (`GET`) with the Zod above. Isolation `describe` block appended to
   `tenant-isolation.test.ts` (see Verification).

### Phase 4 — Commit the re-basing atomically (blocked by `04-S1`)

1. Tests first: the two invariants of acceptance 2; round trip; a settled trip; the ceiling at its
   boundary; a failing last statement leaves the trip byte-identical; a write injected between read
   and commit rolls back; owner-only; archived.
2. `changeTripCurrency`: re-read, recount, `planRebase`, build the statements with the predicated
   `UPDATE`s, the `CASE` guard last, `runBatch`; map the constraint failure to `RebaseRefusedError`.
3. `changeTripCurrencyFn` (`POST`): call, `trail()` with the new action (action list and its test),
   `mirrorToRoom`. Cite Cloudflare's D1 limits in the ceiling constant's comment.

### Phase 5 — The dialog in Costs (blocked by `04-S1`)

1. `currency-rebase-dialog.tsx` with all states; jsdom tests: every state renders, confirm disabled
   until the preview lands and on a refusal, the rate field required when no rate resolves, focus
   restored on close, and no control reaches `server/`.
2. `screen.tsx`: owner-only header button with `data-part="trip-currency-change"`, dialog state,
   `router.invalidate()` on success.
3. Copy: the `rebase.*` keys in all 23 locales.

### Phase 6 — The edit sheet shows the currency read-only (after PR #779 merges)

1. In the shared trip form, render the currency read-only with the pointer when editing; creation
   keeps the select. Test both modes.
2. Copy: `shell.editTrip.currencyLocked` in all 23 locales. Rebase on develop first: #779 owns these
   files until it merges.

## Verification

The gate is `validation.commands` in `.ai/agentic.config.json`, run on the last commit of every
ticket's PR. No screenshot is compared anywhere (ADR 0016); the plan's `04-S5` frame sets are
history. What proves each ticket is vitest (`unit`, `ui`, the repository project on the
harness whose `db.batch()` rolls back as D1 does) plus the blind A/B pair from
`scripts/visual/capture.mjs` for Phases 5 and 6: resting Costs, then `--click
'[data-part="trip-currency-change"]'` for the preview-loaded dialog, light and dark at
`360x800,1280x900,2560x1440`, `--auth`; the error and refusal states are reached in jsdom because no
capture flag can fail a request. The capture's `console` and `warnings` go into the PR body.

**Tenant-isolation test** (appended `describe`, functions `previewCurrencyChange`,
`changeTripCurrency`, and the three guarded writers): in A's scope, preview and commit on B's trip →
`NotFoundError` and B's whole money footprint (trip row incl. `currency` and `budget_target_minor`,
expenses, shares, settlements, budget items, priced places, reservations, transports, stays)
byte-identical; a re-basing of A's trip 1 leaves A's own second trip byte-identical and B's
footprint identical; a private trip in A's workspace the caller is not a member of →
`NotFoundError` on both; an editor and a viewer → `FORBIDDEN`, an archived trip →
`TripArchivedError`, nothing written; a commit input with an extra key is a parse error; a rate
lookup in A never returns B's frozen rate; a stale `expectedTripCurrency` writes zero rows.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                              | Applied default                                                                                                                                                                                                                                            | Why                                                                                                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | How does the spec relate to the unspecified `04-S1`?                  | Hard dependency on the quoted contract; Phases 3–5 blocked by the `04-S1` ticket; Phases 1, 2, 6 independent. `04-S1`'s own spec wins if they diverge.                                                                                                     | Decided by the software architect sub-agent (confidence high) and the product owner (high): `convertMinor`/`resolveRate` have one owner (`docs/SPEC.md` §8); a self-contained slice builds the same module twice.                                                                                        |
| 2   | The plan says `trips.currency` cannot change; it can.                 | `updateTrip` refuses a different currency (typed authored error), accepts an unchanged one as a no-op; `currency` stays in both input schemas; no "empty trip" exception; the edit sheet goes read-only in Phase 6, after #779.                            | Decided by the security and tenancy reviewer (confidence high; the product owner, medium, preferred an empty-trip exception): `NULL`-currency priced rows make "empty" easy to misjudge, the schema is strict and the sheet always sends the field (`BACKWARD_COMPATIBILITY.md` §2), one writer remains. |
| 3   | What can an owner do with a wrong currency before Phase 4 ships?      | Nothing; stated plainly. `changeTripCurrency` later takes the zero-row case with no rate.                                                                                                                                                                  | Applied from the tenancy reviewer's condition 4 and the product owner's condition: an honest, reversible interim beats a guard with a hole.                                                                                                                                                              |
| 4   | Shares of an `exact` split under a re-basing?                         | Distribute the new amount in proportion to the old `share_minor` through `computeShares` (method `shares`); other methods use the stored weight; remainder in participant order.                                                                           | Decided by the software architect sub-agent (confidence high): the stored weight of an exact row is 1, so the plan's rule would silently make it an equal split; one splitter only.                                                                                                                      |
| 5   | A row whose `original_currency` is the new base?                      | `amount = original`, `rate = 1`, triple kept.                                                                                                                                                                                                              | Decided by the software architect sub-agent (confidence high): the typed figure is the truth, and the round-trip rule only holds if it is used verbatim.                                                                                                                                                 |
| 6   | Which rate converts a row?                                            | One `k` for the batch; `r × k` for every row (an inherited row has `r = 1` after pinning); never a per-row lookup.                                                                                                                                         | Decided by the software architect sub-agent (confidence high): two rates in one batch would not net to zero; re-resolving would overwrite frozen rates.                                                                                                                                                  |
| 7   | `trips.budget_target_minor`?                                          | Converted with `k` through `convertMinor`; old and new shown in the preview; no source kept.                                                                                                                                                               | Decided by the product owner sub-agent (confidence high): clearing is unrecoverable (no screen sets it), keeping it mislabels it, three more columns is a larger migration for a planning figure.                                                                                                        |
| 8   | Settled trips and rounding?                                           | Bounded rounding, disclosed: the preview names the largest movement and each person's leftover on a previously zero ledger; the plan's "settled trip stays settled" and "one unit per member" are dropped; no dust handling in `suggestSettlements`.       | Decided by the product owner sub-agent (confidence medium): inventing balancing rows breaks the stage's title, refusing settled trips removes the safest corrections, the owner must see a phantom debt before confirming.                                                                               |
| 9   | Stale writers?                                                        | An optional `expectedTripCurrency` asserted by client-originated writers, keyed on the client's belief about the trip, refused with a typed error; `recordPaymentSchema` gains an optional `currency`; booking sync passes nothing; required next release. | Decided by the security and tenancy reviewer (confidence medium) and the architect (medium): a row-currency guard would refuse legitimate foreign booking lines and never fires for payments, whose currency the server fills in.                                                                        |
| 10  | Size of a re-basing?                                                  | One atomic batch, `MAX_REBASE_STATEMENTS = 900` enforced in preview and again in commit, no chunking; `CASE`-keyed share `UPDATE`s to admit about 400 entries; the D1 figure is cited by the implementer.                                                  | Decided by the architect (confidence high), the product owner (medium) and the tenancy reviewer (medium): chunking brings back the half-re-based state; the limit could not be verified offline, so it is conservative and flagged.                                                                      |
| 11  | The read-then-write race?                                             | Predicated per-row `UPDATE`s plus a last `UPDATE trips` whose `CASE` raises a `NOT NULL` failure when any trip row is still in another currency or a split no longer sums, rolling the batch back.                                                         | Decided by the security and tenancy reviewer (confidence medium): a post-commit check is too late, and the harness reproduces D1's rollback.                                                                                                                                                             |
| 12  | Who may re-base, and when?                                            | Owner only (`assertTripRole(['owner'])` after `requireWritableTrip`), on a non-archived trip, preview and commit alike, inside the repository.                                                                                                             | Decided by the security and tenancy reviewer (confidence high): currency is trip metadata (`CONTEXT.md`, PRD #104 decision 6); archive is a record not to be rewritten; the preview may become a billed provider call.                                                                                   |
| 13  | Ledger rows in a currency that is neither old nor new (booking sync)? | Refuse the re-basing with the count; a row already in `new` is kept as typed.                                                                                                                                                                              | Default applied (refusal beats corruption): `k` is not a rate for a third currency; flagged by the product owner and tenancy reviewers as a case the plan misses. Converting such lines is listed as a follow-up.                                                                                        |
| 14  | Prices on reservations, transports, stays with a `NULL` currency?     | Pinned to `old` with places (rule 7), never converted.                                                                                                                                                                                                     | Raised by the product owner and tenancy reviewers: `NULL` renders as the trip's currency, so only pinning keeps them honest.                                                                                                                                                                             |
| 15  | Where is the entry point?                                             | A header action on Costs, owner only, not `costs-toolbar.tsx` (the filter bar).                                                                                                                                                                            | Default applied from the code: the toolbar is the expense filter bar; the header already hosts the screen's actions.                                                                                                                                                                                     |
| 16  | What replaces the plan's screenshot-baseline verification?            | Vitest plus the blind A/B pair through `capture.mjs`; no `e2e/__screenshots__` and no `budget-and-currencies.visual.spec.ts`.                                                                                                                              | ADR 0016 removed the pixel gate; one defensible answer in the repository, so no specialist was needed.                                                                                                                                                                                                   |
| 17  | Rate bounds and where the rate comes from at commit?                  | `1e-7 ≤ rate ≤ 1e7`; the commit takes the previewed rate as input and does not look one up; `resolveRate` is called only in the preview.                                                                                                                   | Default applied: a rate the owner has seen is the one that is written; the bounds admit VND ↔ KWD.                                                                                                                                                                                                       |
| 18  | Refusal copy: catalogue or authored?                                  | The preview returns structured refusals rendered from the catalogue; commit-time races and the relabel refusal are authored English errors in `AUTHORED_ERROR_NAMES`.                                                                                      | Default applied from `src/server/errors/public.ts`: authored errors are English refusals today; translating them is a platform gap, not this stage's.                                                                                                                                                    |
| 19  | Authorisation of the three out-of-scope defects found on the way?     | Reported as follow-ups, not built.                                                                                                                                                                                                                         | Default applied (surgical changes): separate concepts with their own owners; the tenancy reviewer found them, this stage must not widen.                                                                                                                                                                 |
