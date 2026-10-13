# Change a trip's accounting currency without moving any money

| Field              | Value                                          |
| ------------------ | ---------------------------------------------- |
| **Status**         | in-progress                                    |
| **Issue**          | none                                           |
| **Spec PR**        | #828                                           |
| **Implementation** | #896                                           |
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
currency with their numbers untouched. This spec therefore starts by closing that door (while
keeping the one safe case open: a trip with nothing priced in it), then builds the one writer that
may open it for a trip with money in it: `changeTripCurrency`, a previewed, owner-only,
single-batch operation, with an entry point in the Costs header. Five phases; the first needs
nothing from the still-unspecified `04-S1`, and the rest are an ordered chain behind it.

**What a traveller calls it.** The trip form already labels the field "Budget currency"
(`shell.ts`). That is the only name a traveller sees in this stage (button, dialog, toast, pointer
text). "Accounting currency" is the plan's and this spec's engineering term and appears in no
catalogue string.

This spec describes the work that is **left** at HEAD and departs from the plan's stage block in the
places where the plan predates the code, an ADR or a specialist's read. Each departure is a row of
the Resolved assumptions table.

## 📝 Problem Statement

What exists (`MNY-06` is `partial`):

- `trips.currency` (`schema.ts`, `NOT NULL DEFAULT 'EUR'`), chosen at creation.
- `expenses`, `settlements` carry `amount_minor` + `currency` and the source triple
  (`original_amount_minor`, `original_currency`, `exchange_rate`). `expense_shares` carries
  `share_minor` and `weight`. `budget_items` carries `planned_amount_minor` + `currency` (NOT NULL,
  default `'EUR'`) with no source triple. `places`, `reservations`, `transports`,
  `day_accommodations` carry a price and a **nullable** `currency`. `trips.budget_target_minor` is a
  figure in the trip's currency with no currency column.
- **A bare relabel is reachable.** `tripFields.currency` (`src/server/repos/trips.ts:141`) is part of
  `updateTripInput`; `updateTripInputSchema` (`src/routes/_app/-server/trip-lifecycle.ts:180-189`)
  accepts it; `TripFormFields` renders the select (`-ui/trip-form.tsx:197-207`) and `TripEditSheet`
  (`-ui/trip-actions.tsx`) sends it on every save. Nothing re-bases anything.

What is missing:

- No way to change the currency that keeps the books true.
- No `budget_items` source columns, so a planned figure cannot be re-based without rewriting what the
  traveller typed.
- `convertMinor()`, `resolveRate()` and `src/server/repos/rates.ts` (plan stage `04-S1`, #835) did
  not exist when this spec was written; they are on `develop` now, and `04-S2`, `04-S3` still have
  no spec.

Why it matters: a currency change is the traveller correcting "I picked EUR but we are paying in
JPY". Done as a relabel, 12,400 JPY becomes 12,400 EUR with no error anywhere; done as a re-basing
the same dinner reads 74.20 EUR and every balance stays what it was worth. The failure is silent and
shows weeks later as a debt that is wrong by the exchange rate.

## 📝 Proposed Solution

### What the stage owns and what it does not

Owns: the refusal of a bare currency edit (and the empty-trip case it still allows); the guard that
stops a stale tab writing money in the old currency; the re-basing (preview and commit) and its
repository; the Costs-header entry point and dialog; the read-only currency in the trip edit sheet.

Does not own: `convertMinor`, `resolveRate`, `rates.ts` and the frozen-rate lookup (`04-S1`, quoted
below); the expense dialog, ledger list and writers' UI (`04-S3`); charts (`04-S4`); settlement
suggestions (`04-S6`); a rate provider (`04-S7`).

The plan's owned-path list names `costs-toolbar.tsx` for the entry point; this spec drops it (that
file is the expense filter bar) and uses the header actions in `-costs/screen.tsx` instead, so a
path-collision check against the plan should not flag it.

### The contract consumed from `04-S1` (its spec wins if it diverges)

Quoted from `docs/plans/04-budget-and-currencies.md` § `04-S1`, not invented here:

- `convertMinor(minor, rate, from, to): number` in `src/lib/money.ts`; `rate` is major-per-major
  (`1 from = rate to`), the result applies the digit difference and rounds half-up exactly once;
  `convertMinor(x, 1, c, c)` is the identity.
- `resolveRate(scope, { from, to, on, manual? }): Promise<{ rate: number, source: 'manual' | 'recent' | … } | null>`
  in `src/server/repos/rates.ts`. It never invents a rate and returns `null` when nothing answers.
  The `RateSource` port has no implementation until `04-S7`; this stage must not assume a provider.
  The `recent` source ("the last rate this workspace froze for the pair") must draw only from trips
  the caller can read; Phase 2's isolation test asserts it, and a failure there is a bug in
  `04-S1`'s `resolveRate`, fixed there.

Phases 2 to 5 are an ordered chain behind the `04-S1` ticket. Phase 1 is not.

### The rules (what each prevents)

1. **Pin before you move.** A row that inherited the trip's currency gets its source triple filled
   from itself (`original_amount_minor = amount_minor`, `original_currency = old`,
   `exchange_rate = 1`) in the same statement that converts it. Otherwise the typed figure is lost.
2. **Amount and code move together.** One `UPDATE` per row writes `amount_minor` (or
   `planned_amount_minor`), `currency` and the source triple at once. A row is never left with the
   new amount and the old code.
3. **One rate, once.** `k` (`1 old = k new`) is fixed by the owner in the preview and sent with the
   commit; the commit does not look a rate up. Every row uses that `k`.
4. **Converting a row.** Let the row's source be `(orig, origCur, r)`, pinned as above for an
   inherited row (`r = 1`). If `origCur === new`: `amount = orig`, `rate = 1` (the traveller's figure
   is the truth; no rounding drift). Otherwise `amount = convertMinor(orig, r × k, origCur, new)` and
   `exchange_rate = r × k`. A source amount of zero converts to zero and keeps its stored rate.
5. **Rows already in another currency.** An expense, settlement **or budget item** whose `currency`
   is neither `old` nor `new` (a booking priced in yen synced into the ledger without a source
   triple, `fns/reservations.ts:309-337`; a planned item typed in any currency, since
   `createBudgetItemInput` takes a free `currency`) has no rate to `new` that `k` supplies. The
   re-basing is **refused** with the count, never guessed. A row whose `currency === new` is kept as
   typed (`orig = amount`, `rate = 1`).
6. **Shares are recomputed through the one splitter.** For every expense with share rows, new shares
   come from `computeShares` (`src/server/repos/expenses.ts`), imported, not copied. The input it
   takes depends on the method: `equal` takes no weight; `shares` takes each participant's stored
   `weight` as `weight`; `percentage` takes the stored `weight` as `percentage` (`computeShares`
   reads `part.percentage` for that method, so passing it as `weight` throws `SPLIT_MISMATCH`);
   `exact` is re-run as method `shares` with each participant's **old `share_minor`** as the weight
   (the stored weight of an exact row is 1, so using it would turn the split into an equal one).
   Remainder units go in participant order, exactly as `computeShares` does it. A new amount of zero
   gives zero shares. The sum equals the new `amount_minor`; `is_settled`, `weight` and
   `split_method` are untouched.
7. **Reference prices are pinned, not converted.** `places`, `reservations`, `transports`,
   `day_accommodations` rows with `price_minor IS NOT NULL AND currency IS NULL` get
   `currency = old`. Their `NULL` meant "the trip's currency" on every screen, so leaving them would
   relabel them. They are never netted into a balance and never converted. The preview says so.
8. **The budget target** (`trips.budget_target_minor`) is converted with the same `k` through
   `convertMinor`. It has no source columns, so a round trip old → new → old may differ from the
   starting figure by rounding on this one number; the preview shows the old and new figure, and the
   audit row records both (below).
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

### How a refusal reaches the traveller

`docs/SPEC.md` §9 rule 10 and the header of `src/server/errors/public.ts` close
`AUTHORED_ERROR_NAMES`: a new refusal class does not join it, it travels as a **message key** the
client resolves in the reader's locale (the `SHELL_STATE_KEYS` shape). This stage follows that rule
and edits neither §9 nor the pinned list:

- `src/lib/currency-refusals.ts` (framework-free, imports no React, no router, nothing from
  `server/`, like `components/layout/session.ts`) exports
  `CURRENCY_REFUSAL_KEYS = ['shell.editTrip.currencyLocked'] as const satisfies ReadonlyArray<MessageKey>`
  in Phase 1 (the `satisfies` check and the 23-locale parity test would otherwise force strings that
  have no caller yet into Phase 1); Phase 3 appends `'costs.refusal.tripCurrencyChanged'` and
  `'costs.refusal.rebaseChanged'`; and `currencyRefusalOf(error): MessageKey | null`, which reads the key out of the redaction envelope
  or the raw message, as `shellStateOf` does.
- One server class, `CurrencyRefusalError extends RepositoryError`, in `src/server/repos/trips.ts`,
  whose `message` is one of the keys. It is **not** in `AUTHORED_ERROR_NAMES`.
- `classifyFailure` (`src/server/errors/public.ts`) lets those keys through exactly as it does
  `SHELL_STATE_KEYS`, and `public.test.ts` pins the new set the way it pins that one.
- Callers resolve the key with `t(key)` and fall back to their own generic message otherwise. Phase 1
  ships the module, the classify change and the edit sheet's use of it; later phases add keys to
  the list (a change to the pinned test in the same ticket, so tickets that add keys touch the same
  three lines and are ordered by the chain).

### Atomicity and the stale-read race

All work is **one `runBatch`** (`src/server/repos/batch.ts`), which on D1 is a single atomic
`db.batch()`. Three things make "a half-re-based trip is not a reachable state" true, not hoped for:

1. **Statement budget.** The batch is: one `UPDATE` per expense, per settlement and per budget item;
   `CASE`-keyed `UPDATE`s of `expense_shares`, each carrying at most `SHARE_ROWS_PER_STATEMENT`
   rows; four set-based pin statements (places, reservations, transports, stays); and the final
   `trips` statement. A share statement binds **three** parameters per row (`WHEN id = ? THEN ?`
   plus the id in the `IN` list) and a handful of fixed ones (workspace, trip, expense), so
   `SHARE_ROWS_PER_STATEMENT = Math.floor((MAX_BOUND_PARAMETERS - 6) / 3)` (31 at 100 bound
   parameters), defined once beside `MAX_REBASE_STATEMENTS` and used by both `countRebaseStatements`
   and the builder; a test builds an expense with exactly that many participants and one more.
   `countRebaseStatements(plan)` is used by the preview and by the commit; the constant
   `MAX_REBASE_STATEMENTS = 900` is enforced by the commit **again** before it builds the batch
   (the preview figure is advisory). The 100 statements of headroom under 1,000 are for the rest of
   the invocation: auth, `requireWritableTrip`, `assertTripRole`, the five pre-reads, `trail()` and
   the room mirror. In traveller terms the ceiling admits a trip of roughly **400 logged expenses
   and payments together**, however many people share them (about two statements per split
   expense). Above it nothing is written and the dialog says the trip is too large to change in one
   step. No chunking: a chunked re-basing is not atomic. The number assumes Cloudflare's **paid-plan**
   D1 limit of 1,000 queries per Worker invocation (every statement of a batch counts); the free
   plan is lower (50), the repository states neither, and this spec could not verify them offline.
   Phase 3's implementer cites the current Cloudflare D1 limits page in the constant's comment,
   checks which plan production runs on, and lowers the constant if the page says less. It is an
   exception to `docs/SPEC.md` §5 ("keep D1 transactions small") taken deliberately, because the
   alternative is a non-atomic money rewrite; it is bounded by the ceiling and by this being a rare,
   owner-only act.
2. **Fixed read cost.** The pre-reads are one query per table filtered by `trip_id`
   (`expenses`, `expense_shares`, `settlements`, `budget_items`, the trip row), never the
   per-expense `getExpenseWithShares` pattern `loadCosts` uses.
3. **The batch rolls back if anything moved since the read.** Every per-row `UPDATE` is predicated on
   the values read (`WHERE id = ? AND amount_minor = ? AND currency = ?`, plus the tenant and trip
   predicates through `tenantFilter`), and a share `UPDATE` carries `expense_id`, the ids read and
   the tenant and trip predicates (through `tenantFilter`, or, where `expense_shares` has no tenant
   column, `expense_id IN (SELECT id FROM expenses WHERE <tenantFilter …>)`). A predicate that
   matches nothing does not raise, so it is the **last** statement that turns it into a failure:
   `UPDATE trips SET currency = CASE WHEN currency <> old OR <stale> THEN NULL ELSE ? END,
budget_target_minor = ? WHERE id = ? AND <tenant predicate>`. The old-currency test is inside
   the `CASE`, not in the `WHERE`, so a commit that finds the trip already moved (a double commit)
   raises too instead of matching zero rows and reporting success. `<stale>` is true when, **at
   batch time and over every row of the trip, not only the ids read**: any expense, settlement or
   budget item has a `currency` other than `new`; or any expense that has at least one share row
   has shares that do not sum to its `amount_minor`. Every subquery inside the `CASE` is built with
   `tenantFilter(scope, table, eq(table.tripId, tripId))`, never a bare `trip_id = ?`.
   `trips.currency` is `NOT NULL`, so a stale trip raises a constraint failure and D1 rolls the
   whole batch back; nothing is checked after commit, because by then the corruption has landed.
   The commit maps that failure to `CurrencyRefusalError('costs.refusal.rebaseChanged')`.

### The writers that may change `trips.currency`

After creation exactly two code paths write it, each under a distinct precondition:

- **`updateTrip` (Phase 1), the empty trip.** A trip with nothing priced in it may change currency
  with no rate and no conversion: the owner fixes a currency picked by mistake on a new trip, in the
  same save as any other field. "Priced" means, counting a row whose `currency` is `NULL`: any
  expense, expense share, settlement or budget item; `budget_target_minor IS NOT NULL` (a target of 0
  counts); any place, reservation, transport or stay with a `price_minor`; or
  `copy_pending_at IS NOT NULL` (a trip copy in progress looks empty until the queue copier adds its
  priced places, whose nullable `currency` would then be silently relabelled).
  - **One definition, two forms.** `pricedRowsExistSql(scope, tripId): SQL` in `trips.ts`
    (tenant-filtered **and** trip-filtered subqueries) and `pricedRowsExist(scope, tripId)`, a boolean
    reader built on it. The pre-check, the guarded `UPDATE` and Phase 3's zero-count case share it, so
    they cannot drift.
  - **When the guard applies.** Only when the incoming `currency` is present **and differs** from the
    stored one (the sheet sends `currency` on every save, so an unconditional guard would refuse
    every save on a priced trip). Otherwise `updateTrip` keeps its existing `requireUpdate` path and
    an unchanged `currency` stays a no-op.
  - **The statement.** `requireUpdate` cannot express it (`TenantPatch<T>` types `currency` as a
    `string`), so the changed-currency path calls Drizzle directly:
    `scope.db.update(trips).set({ ...values, currency: sql\`CASE WHEN ${pricedRowsExistSql(scope, tripId)} THEN NULL ELSE ${value} END\` }).where(tenantFilter(scope, trips, eq(trips.id, tripId))).returning()`.
One D1 statement is atomic, so no batch is needed (and `runBatch`returns`void`, while
`updateTrip`returns the row). The conflict resolution stays the default`ABORT`, never
`OR REPLACE`(which would write the column default`'EUR'` instead of raising).
  - **Behaviour.** The subqueries see the row as it was before the update, so one save that sets a
    budget target and a new currency on an empty trip succeeds, by design. A trip that gained a
    priced row between the page and the save fails the `NOT NULL` check and nothing in the save is
    applied. The statement runs **before** `syncTripDays` and any other write of the save, which the
    injected-row test asserts.
  - **Error mapping.** D1/Drizzle wrap the constraint error, so the mapping matches
    `NOT NULL constraint failed: trips.currency` in `message` **and** in `cause.message` and rethrows
    anything else; a Phase 1 test on the real harness shows the failure is raised there with that
    text, and Phase 3's `rebaseChanged` mapping uses the same matcher.
  - **Archived trips.** `requireOwnedTrip` does not check the archive flag today. A currency change
    on an archived trip is refused with the existing `TripArchivedError` (a pre-check before the
    statement); every other field of an archived trip's save behaves exactly as today, and that is
    not changed here.
- **`changeTripCurrency` (Phase 3), a trip with money in it.** The re-basing. A trip that turns out
  to have nothing to convert takes this path with an empty plan: only the final `trips` statement
  runs. A plan is empty only when `pricedRowsExist` is false; a non-null `budget_target_minor` makes
  it non-empty and **needs a rate**, while pinned reference prices alone need none. The final
  `<stale>` test also holds while `copy_pending_at IS NOT NULL`, and the preview refuses a trip
  whose copy is still pending (`refusal.kind = 'copy-pending'`, shown with `rebase.copyPending`).

A different currency on a trip that has priced rows, sent through `updateTrip`, is refused with
`CurrencyRefusalError('shell.editTrip.currencyLocked')`, the whole save included.

### Stale writers

A tab that loaded Costs before a re-basing must not write money in the old currency. The **five**
client-originated money writers in `src/server/repos/expenses.ts` — `createExpense`, `updateExpense`,
`createSettlement`, `createBudgetItem`, `updateBudgetItem` (the last two take a free `currency`) —
accept an optional `expectedTripCurrency`; when present and different from the trip's current
currency they throw `CurrencyRefusalError('costs.refusal.tripCurrencyChanged')` before any insert
(and before `writeShares`), nothing written. `assertExpectedTripCurrency(trip, expected)` and the
error class live in `trips.ts`, which `expenses.ts` already imports (`requireTrip`) and which
imports nothing from `expenses.ts`, so there is no cycle with `trip-currency.ts` (which imports
`computeShares` from `expenses.ts`). `updateExpense` / `updateBudgetItem` take the trip id from the
caller (#836) and look the row up inside that trip. The guard is keyed on the **client's belief about the trip**, not on the row's own
`currency`, because booking sync legitimately writes a booking's own currency
(`fns/reservations.ts:312`) and passes no assertion (it is server-derived and cannot be stale).
`createExpenseFn` / `updateExpenseFn` pass `body.currency`, which the expense dialog already sends;
`recordPaymentSchema` gains an optional field named `expectedTripCurrency` (not `currency`, which
`04-S1`'s foreign-currency payment fields will want for the payment's own currency) that the
payment dialog sends, while `recordPaymentFn` keeps writing `trip.currency`. A missing value keeps
today's behaviour for one release (`BACKWARD_COMPATIBILITY.md` §2) and becoming required is a
follow-up.

**The window that stays, named.** The check and the write are two statements (`createExpense`
et al. insert in several), so a stale write that lands between a re-basing's read and its batch is
caught by the batch's own stale check (above), but one whose check passes just before a re-basing
commits and whose insert lands just after it leaves one row in the old currency on the re-based
trip. That needs a member's save and an owner's confirm inside the same few milliseconds; the
result is an honest, visible foreign line (the same shape booking sync already produces) that the
owner edits or deletes, and the next re-basing's `unconverted-rows` refusal names it. Closing it
entirely means moving every writer to a guarded batch, which is not this stage.

### Alternatives considered, and why they lost

- **Self-contained stage with its own `convertMinor` and rate resolver.** Two owners for one concept
  (`docs/SPEC.md` §8) and two stages editing the same new modules. Rejected for the quoted contract.
- **Only close the relabel, no empty-trip path.** Leaves an owner unable to fix a wrong currency on
  a brand-new trip for as long as the `04-S1` chain takes, which may be long. Rejected: the
  precise "nothing priced" test is cheap and atomic.
- **Remove `currency` from `updateTripInputSchema`.** The schema is strict and the sheet sends the
  field on every save, so a tab on the previous bundle would fail even a rename
  (`BACKWARD_COMPATIBILITY.md` §2). The field stays accepted; an unchanged value is a no-op.
- **Add the three refusal classes to `AUTHORED_ERROR_NAMES`.** Rejected: the set is closed by
  `docs/SPEC.md` §9 rule 10; message keys are the documented path and translate.
- **Chunk the batch or move it to a queue.** Reintroduces the half-re-based state (and a queue
  consumer faces the same per-invocation limit). Rejected for a named ceiling.
- **Clear or keep the budget target.** Clearing loses a figure with no screen to set it again
  (nothing but the dev seed writes it); keeping it is the mislabelling this stage prevents.

## 📝 Architecture

- **Owner of each new concept** (`docs/SPEC.md` §8): the re-basing (planning, preview, commit,
  statement count, stale check) — `src/server/repos/trip-currency.ts`; the two server functions —
  `src/server/fns/trip-currency.ts`; the empty-trip rule, `pricedRowsExist`, `CurrencyRefusalError`
  and `assertExpectedTripCurrency` — `src/server/repos/trips.ts` (it owns `trips.currency` writes
  and the trip's own error classes); the refusal keys — `src/lib/currency-refusals.ts`; the dialog —
  `-costs/currency-rebase-dialog.tsx`, route-local, imported relatively by `-costs/screen.tsx` (one
  caller, and `src/components/costs/index.ts` is held by `04-S4`).
- **Import direction.** `trip-currency.ts` is a leaf (only `fns/trip-currency.ts` imports it) and
  imports `expenses.ts` (`computeShares`) and `trips.ts`; `expenses.ts` imports `trips.ts`
  (`requireTrip`, `assertExpectedTripCurrency`). The stage adds no new edge into the cycle that
  already exists through `trips.ts` → `itinerary` → `reservations` → `expenses` → `trips`;
  `CurrencyRefusalError` and `assertExpectedTripCurrency` are used only at call time, never in
  top-level evaluation of `expenses.ts`.
- **Pure core, thin shell.** `planRebase(snapshot, { old, to, rate })` is a pure function over rows
  read once and returns the new rows, the counts, the statement count, the budget target and the
  balances before and after. Preview and commit both call it, so what the owner confirms is what is
  written. `netBalances(rows)` is pure too; a parity test pins it to `getMemberBalances` on the same
  fixture so the balance formula has one definition in behaviour.
- **Seams.** SQL only in `server/repos`; every statement through `tenantFilter(scope, table,
eq(table.tripId, tripId), …)` (the `deleteTrip` precedent at `trips.ts:879-887`), so a bulk
  `UPDATE` never loses its tenant or trip predicate. `components/costs` and `components/ui` import
  nothing from `server/`. The dialog calls the functions through `useServerFn` from the route layer.
- **Errors.** One class and a closed key list (above); the **preview** returns its refusals as
  structured data (`{ kind: 'no-rate' | 'unconverted-rows' | 'too-large', … }`) so the dialog renders
  them from the 23-locale catalogue. `AUTHORED_ERROR_NAMES`, `docs/SPEC.md` §9 and the header of
  `public.ts` are not edited.
- **Audit and room.** After a successful commit the function calls `trail()` with a new
  `AUDIT_ACTIONS.TRIP_CURRENCY_CHANGED = 'trip.currency_changed'` (`src/server/audit/trail.ts`),
  flat metadata `{ from, to, rate, expenses, settlements, budgetItems, pinnedPrices,
budgetTargetBefore, budgetTargetAfter }`, and mirrors
  `patch('trip', id, { currency, budgetTargetMinor, expensesChangedAt })` to the trip room. The
  audit row is best-effort (`trail()` swallows failures) and is the only place the budget target's
  before value is kept. No new patch kind; `src/server/do/protocol.ts` is untouched.
- **No quota.** It updates rows and creates none: nothing in `resolveLimits()` / `PLAN_QUOTAS`.
- **No new route**: no `pnpm generate-routes`.

## 📝 Data Model

One additive migration (Phase 2), generated by `pnpm db:generate` and never hand-edited:
`budget_items` gains `original_amount_minor integer`, `original_currency text(3)`,
`exchange_rate real`, all nullable, no default, no `CHECK`, no index (a `CHECK` change rebuilds a
table on SQLite; the non-negative guard and the all-three-or-none rule live in the repository's Zod,
as for `settlements`). `NULL` reads as "no conversion happened, implied rate 1"; only a re-basing
fills the columns, and no other budget-item writer changes. The previous Worker reads none of them,
so a rollback is safe.

The plan files these columns under `00-foundations` and says this stage touches neither `schema.ts`
nor `drizzle/`; the spec departs from that because no ticket or spec at this commit adds them and
the re-basing is their first reader. Phase 2's ticket first checks that no `00-foundations` ticket or
spec has added the same columns since (two owners would break `docs/SPEC.md` §8) and, if one has,
drops the migration and consumes theirs.

Everything else the stage touches already exists. No backfill.

## 📝 API Contracts

- `previewCurrencyChangeFn` (`GET`) input `z.strictObject({ tripId, to: currencySchema, rate:
z.number().finite().min(1e-7).max(1e7).optional() })` with a refinement `to !== trip.currency`.
  Output: `{ from, to, rate: { value, source } | null, counts: { expenses, settlements, budgetItems,
shareRows, pinnedPrices }, example: { original, converted } | null, budgetTarget: { before, after
} | null, balances: { maxMovementMinor, leftovers: Array<{ userId, otherUserId, amountMinor }> },
statements, ceiling, refusal: null | { kind, … } }`. With no `rate` it asks `resolveRate` (manual
  absent); with a `rate` it uses it as `manual`. `leftovers` carries participant ids as `getMemberBalances` keys them, never names.
- `changeTripCurrencyFn` (`POST`) input `z.strictObject({ tripId, to, rate: <the same bounded
number>.optional() })`; `rate` is required unless `pricedRowsExist` is false. Output: the
  counts it actually wrote. An extra key (say `expenseIds`) is a parse error.
- Bounds: every converted amount must be a safe integer, else the commit throws
  `CurrencyRefusalError('costs.refusal.rebaseChanged')` after the preview would have refused it;
  the rate bounds keep VND ↔ KWD in range.
- Edited contracts: `createExpenseInput`, `updateExpenseInput`, `createSettlementInput`,
  `createBudgetItemInput`, `updateBudgetItemInput` gain `expectedTripCurrency?`;
  `recordPaymentSchema` gains `expectedTripCurrency?`; `updateTrip` refuses a different `currency`
  on a trip with priced rows.

## 📝 UI/UX

- **Entry point.** A `Change budget currency` button in `TripModuleHeader` `actions` on Costs
  (`-costs/screen.tsx`), next to Export / Settle up / Add expense, **shown to the owner only**
  (role of `viewerUserId` in `data.people`); the server refusal is what counts. It carries
  `data-part="trip-currency-change"`. It is the least frequent action, so it is the last and a
  secondary (ghost) button; the header actions already wrap, and at 360 px, where its label is the
  longest (longer still in de and pl), it takes a row of its own rather than truncating. The
  Phase 4 capture checks 360 px.
- **The dialog is a confirmation with arithmetic in it.** Built on the `Dialog` primitive (focus
  trapped and restored, Escape closes, a full-height sheet on small screens). Top to bottom:
  - A currency `Select` (the shared currency options, minus the current one).
  - A **rate `Field`** with a persistent visible label (`rebase.rateLabel`), the rate prefilled from
    where it came from ("the last rate used in this workspace, 12 Sep" / "the rate you entered")
    and the inverse beside it ("that is 1 EUR = 165 JPY", so a rate typed the wrong way round is
    visible before the bounds catch it). It accepts the locale's decimal separator (`0,0060` in pl
    and de) and renders with `inputMode="decimal"` so a phone keyboard offers it. An empty, non-numeric or out-of-bounds value shows `rebase.rateInvalid` as the field's
    error text with `aria-invalid`, tied by `aria-describedby`; no rate on record shows
    `rebase.noRate` as the hint.
  - One preview result region: the worked example ("12,400 JPY stays as you typed it and is counted
    as 74.20 EUR"), one line per non-zero count, the pinned-prices line, the budget-target line,
    the rounding line and any leftover.
  - `Change to EUR` / `Cancel`.
- **What the dialog commits is what it showed.** The preview re-runs on input (debounced, about
  400 ms) and on `Select` change, never on blur and never on Enter alone; Enter in the rate field
  runs the preview and does not commit. Any change to `to` or the rate clears the shown preview and
  disables confirm until a preview for the _current_ pair has arrived; the commit sends exactly the
  `to` and `rate` that preview was computed with. A tap on confirm therefore never races a blur.
- **Announcements.** The preview result region stays mounted as one polite live region
  (`aria-busy` while the `Skeleton` shows), so a recomputed result, a refusal or a no-rate message is
  announced after a rate edit or a `Select` change. Refusals (`unconverted-rows`, `too-large`,
  no-rate) use `Alert tone="warning"`; a preview or commit **failure** uses `Alert tone="danger"`
  (not the neutral tone, which carries an info icon and polite urgency). **One announcer per
  message:** `Alert` is itself a live region, so the `warning` alerts inside the result region pass
  `aria-live="off"` (the region speaks), and the `danger` failure alert renders **outside** that
  region (it announces on insertion, `role="alert"`). The no-rate text is shown once, as the field's
  hint; the result region only says the preview is waiting for a rate. A jsdom test asserts each
  message has exactly one live-region ancestor.
- **States.**
  - Loading: `Skeleton` sized to the result, confirm disabled until it lands.
  - No currency chosen yet: only the description and the `Select`; the rate field and the preview
    appear after a choice (the rate label interpolates the new currency).
  - No rate on record: rate field empty and required, confirm disabled.
  - Unconverted rows: a refusal naming the count and what the entries are, confirm disabled.
  - Too large: a refusal naming the size and the limit and what to do, confirm disabled.
  - Preview failure: `Alert` danger, a retry button (`rebase.retry`), confirm disabled.
  - Nothing to convert: "Nothing on this trip is priced yet, so nothing needs converting" and the
    confirm is enabled.
  - Committing: confirm `loading` with a `loadingLabel` (the `Button` sets native `disabled`),
    `Select`, rate and Cancel `disabled`, the Dialog's close button hidden (`hideClose`), **Escape
    and outside-press ignored** so the outcome cannot be missed. The commit request has a 30-second
    timeout that lands in the commit-failure state, so a hung request cannot trap the traveller in a
    modal they cannot leave.
  - Commit failure: `Alert` danger with the retry button, and **focus moves to the retry button**
    (the confirm is natively disabled while loading, so focus would otherwise drop to the body). If
    the refusal is `rebaseChanged` the dialog re-runs the preview and shows the new figures. **After
    any failure that is not a known refusal** (a dropped response, a timeout) the dialog first
    re-reads the trip: if its currency is already `to` the change went through and the success path
    runs; only otherwise does it say nothing was changed (`rebase.commitError`), which is then true
    because the batch is atomic.
  - Success: the dialog closes, `router.invalidate()`, a toast `rebase.done`.
- **A stale tab keeps what the traveller typed.** When an expense, payment or planned-item save is
  refused with `costs.refusal.tripCurrencyChanged`, the existing dialog stays open with its input,
  `router.invalidate()` reloads the data behind it, and the refusal text names the new currency and
  says to check the amount and save again. What the dialog then shows is stated, because the
  expense dialog sets its currency once from the trip when it opens (`expense-dialog.tsx`) and would
  otherwise flip silently: the amount field keeps the typed digits and is marked invalid with the
  refusal text until the traveller edits it; in the expense dialog the currency control is reset to
  the trip's new currency (never left on the old one), and in the payment dialog the digits are not
  re-labelled by the reload; either way the traveller must touch the amount before it can be saved. The shared `run()` in `-costs/actions.ts` (whose
  failure toast is a hardcoded English fallback today) resolves a refusal key through
  `currencyRefusalOf` and `t()`; its other fallbacks are not this stage's.
- **Edit sheet** (Phase 5, after PR #779 merges and Phase 4 ships): the currency renders as read-only
  text with `shell.editTrip.currencyReadonly` and a link to the Costs tab (`shell.editTrip.currencyLink`
  names the link; the sentence is not itself the only link text); the form stops offering the select
  on edit. Creation is unchanged. Until then (Phases 1 to 3) the select stays and the Phase 1
  refusal tells the owner the currency cannot be changed because the trip has prices, without
  naming a button that does not exist yet.
- Tokens: `--space-*`, `--radius-xl`, `--shadow-modal`; `tabular-nums` on the rate, the counts and
  every figure; motion is the primitive's own and honours `prefers-reduced-motion`.

## 📝 Visual change expected

- `/trips/$tripId/costs`: a new `Change budget currency` header button (owner only), light and
  dark, 360 / 1280 / 2560 px. The dialog in: preview loaded with the example; no-rate; refusal
  (unconverted rows, too large); error with retry; nothing to convert; committing. Light and dark,
  desktop and mobile (full-height sheet).
- The trip edit sheet (Phase 1): a refused currency change shows the refusal text in the sheet's
  existing error slot; (Phase 5) the currency row read-only with its pointer and link. Light and
  dark, desktop and mobile.
- No other route changes.

## 📝 Copy

New keys, each in all 23 locales per the `i18n-messages` skill. The rebase dialog's keys go in
`src/lib/i18n/messages/en/costs.ts` under that file's existing prefix; the sheet's in `shell.ts`.
Plural forms use the catalogue's plural mechanism; money and rates come from `formatMoney` /
`formatRate`, never from a message. One name throughout: **budget currency**.

| Key                                 | `en` text                                                                                                                                                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rebase.open`                       | `Change budget currency`                                                                                                                                                                                          |
| `rebase.title`                      | `Change the budget currency`                                                                                                                                                                                      |
| `rebase.description`                | `The amounts you typed stay as you typed them. The totals and balances of this trip are converted to the new currency.`                                                                                           |
| `rebase.to`                         | `New currency`                                                                                                                                                                                                    |
| `rebase.rateLabel`                  | `Exchange rate (1 {from} in {to})`                                                                                                                                                                                |
| `rebase.rateInverse`                | `That is 1 {to} = {inverse} {from}.`                                                                                                                                                                              |
| `rebase.rateInvalid`                | `Enter a rate greater than zero.`                                                                                                                                                                                 |
| `rebase.source.recent`              | `The last rate used in this workspace, {date}`                                                                                                                                                                    |
| `rebase.source.manual`              | `The rate you entered`                                                                                                                                                                                            |
| `rebase.noRate`                     | `There is no rate on record for {from} to {to}. Enter the rate you want to use.`                                                                                                                                  |
| `rebase.example`                    | `{original} stays as you typed it and is counted as {converted}.`                                                                                                                                                 |
| `rebase.count.expenses`             | `{count} expenses will be counted in {to}.`                                                                                                                                                                       |
| `rebase.count.payments`             | `{count} payments will be counted in {to}.`                                                                                                                                                                       |
| `rebase.count.planned`              | `{count} planned items will be counted in {to}.`                                                                                                                                                                  |
| `rebase.pinned`                     | `Prices on places, reservations, stays and transport stay in {from}.`                                                                                                                                             |
| `rebase.target`                     | `The trip budget {before} becomes {after}.`                                                                                                                                                                       |
| `rebase.rounding`                   | `Each amount is rounded once, so a balance can move by up to {amount}.`                                                                                                                                           |
| `rebase.leftover`                   | `After the change, {name} would owe {other} {amount}.`                                                                                                                                                            |
| `rebase.nothing`                    | `Nothing on this trip is priced yet, so nothing needs converting.`                                                                                                                                                |
| `rebase.unconverted`                | `{count} entries are in a currency other than {from} and cannot be converted automatically. They are usually expenses created from reservations priced in another currency: edit or delete them, then try again.` |
| `rebase.tooLarge`                   | `This trip has too many entries to change in one step ({count}; the limit is {limit}). The budget stays in {from} for now.`                                                                                       |
| `rebase.copyPending`                | `This trip is still being copied. Try again in a moment.`                                                                                                                                                         |
| `rebase.error`                      | `The conversion could not be loaded. Nothing was changed.`                                                                                                                                                        |
| `rebase.commitError`                | `We couldn't change the budget currency. Nothing was changed.`                                                                                                                                                    |
| `rebase.retry`                      | `Try again`                                                                                                                                                                                                       |
| `rebase.confirm`                    | `Change to {to}`                                                                                                                                                                                                  |
| `rebase.done`                       | `The budget is now in {to}.`                                                                                                                                                                                      |
| `costs.refusal.rebaseChanged`       | `The trip changed while you were confirming, so nothing was changed. Check the new figures and confirm again.`                                                                                                    |
| `costs.refusal.tripCurrencyChanged` | `The budget currency of this trip is now {to}, so this was not saved. The page has been refreshed: check the amount and save again.`                                                                              |
| `shell.editTrip.currencyLocked`     | `This trip already has prices in it, so its budget currency can't be changed here. Set it back to {current} to save your other changes.`                                                                          |
| `shell.editTrip.currencyReadonly`   | `The budget currency is changed from the Costs tab.`                                                                                                                                                              |
| `shell.editTrip.currencyLink`       | `Open the Costs tab`                                                                                                                                                                                              |

`ui.action.cancel` is reused.

## 📝 Edge Cases & Failure Scenarios

| Case                                                                   | Behaviour                                                                                                                                                                |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Same currency as now                                                   | Refused by the input refinement; the select omits it.                                                                                                                    |
| No rate on record and none typed                                       | Preview `refusal: 'no-rate'`; nothing is invented; confirm disabled.                                                                                                     |
| Rate outside `[1e-7, 1e7]` or a converted amount not a safe integer    | Refused, nothing written.                                                                                                                                                |
| Row in a third currency, no triple (booking sync, planned item)        | Refused with the count (rule 5); a row already in `new` is kept as typed.                                                                                                |
| Foreign receipt whose `original_currency` is the new base              | `amount = orig`, `rate = 1`; the typed figure is exact.                                                                                                                  |
| `exact` split                                                          | Shares distributed over the new amount in proportion to old `share_minor` (rule 6).                                                                                      |
| `percentage` split                                                     | The stored weight is passed as `percentage`; no `SPLIT_MISMATCH`.                                                                                                        |
| Zero amount                                                            | Zero amount, zero shares; stored rate unchanged.                                                                                                                         |
| Trip with nothing priced, edited from the sheet                        | Currency changes in the same save; no rate, no conversion.                                                                                                               |
| Trip gained a priced row between the page and the save                 | The single-statement guard fails; nothing in the save is applied; the owner sees the Phase 1 refusal.                                                                    |
| Trip with priced rows, edited from the sheet                           | Whole save refused with `shell.editTrip.currencyLocked`; nothing applied.                                                                                                |
| Above the statement ceiling                                            | Refused in preview and again in commit; nothing written.                                                                                                                 |
| Row changes between preview and commit                                 | Predicated `UPDATE` plus the final stale check roll the batch back; `rebaseChanged`, the dialog re-previews.                                                             |
| Double commit (two owners, or a retry after success)                   | The second sees `currency <> old` inside the `CASE` and fails; nothing written.                                                                                          |
| Editor, viewer, non-member, archived trip                              | `FORBIDDEN` / `NotFoundError` / `TripArchivedError`; nothing written.                                                                                                    |
| A stale tab saves an expense, payment or planned item after the change | `costs.refusal.tripCurrencyChanged`; the dialog stays open with its input, data refreshes behind it.                                                                     |
| Stale write lands in the few ms around a commit                        | One visible old-currency line (see "The window that stays"); edited or deleted by the owner.                                                                             |
| Old tab or API client sends the unchanged `currency` on a trip edit    | A no-op.                                                                                                                                                                 |
| Re-basing JPY → EUR → JPY                                              | Every row with a source triple returns to its typed figure; the budget target may differ by rounding.                                                                    |
| Booking later re-synced into its expense                               | The booking's price was pinned to `old` (rule 7), so the synced line is honestly in `old` and stays visible as a foreign line; converting such lines is another stage's. |
| Rate field typed with a decimal comma                                  | Parsed with the locale's separator; the inverse is shown.                                                                                                                |

## 📝 Observability

The commit writes one audit entry (`trip.currency_changed`) and the existing server-function logging
applies. A failed batch is logged by the function's error path with the trip id and counts, never
with amounts.

## ✅ Acceptance criteria

1. `updateTrip` with a `currency` different from the stored one throws
   `CurrencyRefusalError('shell.editTrip.currencyLocked')` before any write when the trip has any
   priced row, and applies it (in the same statement as the other fields) when it has none; the
   same value is a no-op; `trips.currency` has exactly the two writers named above after creation.
2. After any re-basing: no expense, settlement or budget item of the trip has a `currency` other than
   `new`, and every row's `amount_minor` equals the conversion of its own source triple (or its typed
   figure when `origCur === new`).
3. Every expense's shares sum exactly to its new `amount_minor`; `is_settled`, `weight`,
   `split_method` survive; an `exact` split stays proportional to its old shares; a `percentage`
   split does not throw.
4. A row's typed figure is unchanged in `original_amount_minor`; JPY → EUR → JPY returns every row
   (the budget target excepted) to its starting figures.
5. Each member's balance moves by at most one minor unit per row they appear in (the test asserts
   that bound, not exact zero); the preview reports the largest movement and every leftover on a
   previously zero ledger.
6. An unresolvable rate, an unconverted row (expense, settlement or planned item), a safe-integer
   overflow and a trip over the ceiling each write nothing, in the preview and in the commit.
7. A write injected between the read and the commit makes the batch roll back and leaves the trip
   byte-identical; a second commit on the same trip fails and leaves it byte-identical; an expense
   with exactly `SHARE_ROWS_PER_STATEMENT` participants and one with one more both re-base.
8. Owner only; editor, viewer, non-member, archived all refused with nothing written. Preview is
   guarded the same way.
9. A stale `expectedTripCurrency` makes `createExpense`, `updateExpense`, `createSettlement`,
   `createBudgetItem`, `updateBudgetItem` write no row; booking sync still writes foreign-currency
   lines.
10. The dialog renders every state in "UI/UX", keyboard-operable, focus trapped and restored, no
    layout shift after the preview lands, silent console; the button is absent for non-owners. The
    preview result and refusals are announced (one live region), the rate error is tied to its
    field, Enter does not commit, confirm is disabled until the preview matches the current pair,
    focus lands on retry after a failed commit, and an axe scan passes in both themes for every
    listed dialog state.
11. Every new string exists in all 23 locales; the parity test is green; `CURRENCY_REFUSAL_KEYS` is
    pinned by `public.test.ts` and `AUTHORED_ERROR_NAMES` is unchanged.
12. `trip.currency_changed` is audited with the before and after budget target and a `trip` patch
    reaches the room.

## 📝 Risks & Impact Review

| Risk                                                                                                                                             | Severity | Mitigation                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bulk `UPDATE` missing its tenant or trip predicate rewrites other trips' money                                                                   | High     | Every statement and every `CASE` subquery via `tenantFilter(…, eq(tripId))`; isolation tests per phase compare a second trip in the same workspace and workspace B's whole money footprint byte for byte. |
| Half-re-based trip                                                                                                                               | High     | One atomic batch, predicated updates, final stale check that raises (incl. double commit); tested with an injected write and an injected failing last statement.                                          |
| `04-S1` has no spec; Phases 2–5 wait for it                                                                                                      | Medium   | Hard dependency, quoted contract, `Blocked by` on the tickets; Phase 1 ships alone and already lets an owner fix a currency on an empty trip.                                                             |
| Until Phase 3 ships an owner cannot change the currency of a trip that has prices                                                                | Medium   | Stated plainly; the refusal explains it; reversible; the empty-trip path covers the common "picked wrong at creation" case.                                                                               |
| D1 per-invocation limit unverified offline (and free-plan limit lower)                                                                           | Medium   | Constant cites the Cloudflare page, implementer checks the production plan and lowers it if the page says less; ceiling enforced twice; 100 statements of headroom.                                       |
| Phantom one-unit debts after a settled trip is re-based                                                                                          | Medium   | Disclosed in the preview before confirming; no hidden fix (Resolved assumption 8).                                                                                                                        |
| The budget target is converted with no kept source                                                                                               | Low      | Old and new shown in the preview; both recorded in the audit row; Resolved assumption 7.                                                                                                                  |
| PR #779 (open) edits `trip-form.tsx`, `trip-actions.tsx`, `trips.ts`, `trip-lifecycle.ts`                                                        | Medium   | Phase 5 waits for it; Phase 1 touches `trips.ts` and one catch in `trip-actions.tsx` and rebases on develop first.                                                                                        |
| Phase 3 edits `expenses.ts`, `fns/costs.ts`, `payment-dialog.tsx`, which the plan gives to `00-S1`, `00-S2`, `04-S1`; Phase 4 edits `screen.tsx` | Medium   | The Phase 3 and 4 tickets carry a "touches paths held by other stages" note and rebase on develop before pushing.                                                                                         |
| Bookings re-synced after the change write a foreign-currency line                                                                                | Low      | Honest label; pre-existing "converting is another stage's"; reported, not fixed.                                                                                                                          |
| A stale write lands in the few ms around a commit                                                                                                | Low      | Named, visible, user-repairable; closing it needs every writer moved to a guarded batch (follow-up).                                                                                                      |

### Out of scope, noticed on the way (follow-up issues, not built here)

- `updateExpenseFn` / `deleteExpenseFn` check `data.tripId` but act on `data.expenseId` without
  checking the expense belongs to that trip (`src/server/fns/costs.ts:482-504`;
  `updateExpense` / `deleteExpense` at `expenses.ts:390-403`, `:497-503`), so a member of one trip
  with an expense id can edit or delete an expense on another trip of the workspace, a private one
  included. Filed as #836 and fixed in #880: every money writer now takes the trip id and looks the
  row up as (trip, row).
- No money writer called `assertTripRole`, so a viewer could log, edit and delete expenses and record
  payments, against `CONTEXT.md` ("a viewer reads"). Filed as #837 and fixed there: every money
  writer in `expenses.ts` now runs `requireTrip` and then `assertTripRole` with owner and editor,
  and the costs payload carries a role-only `canWrite`.
- `getTripSpendSummary` sums `amount_minor` across currencies, so a booking-synced yen line is added
  into a EUR total.
- The Reconciler treats `04-S1`, `04-S2`, `04-S3` as covered by incidental mentions in unrelated
  issues, so their specs may never be written.
- Converting booking-synced foreign lines (rule 5) and removing `currency` from the boundary schema
  one release after the sheet stops sending it.
- Moving the five money writers to a guarded batch to close the named stale-write window.
- The Costs screen around the new button (`Costs`, `Export CSV`, `Settle up`, the toasts in
  `-costs/actions.ts`) is hardcoded English today, so a non-English reader sees one translated
  button among English ones. Not this stage's to fix.

## 📋 Phasing

| Phase | Slice                                                | Demoable on its own                                                                                                                             | Blocked by              |
| ----- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1     | Close the bare relabel, keep the empty trip open     | Saving a different currency in the edit sheet works on a trip with nothing priced, and is refused in the owner's language when it has prices    | nothing                 |
| 2     | Preview what a re-basing would do                    | Server function only: returns counts, example, target and balance disclosure for a trip, or a refusal (shown through tests or a direct call)    | `04-S1`                 |
| 3     | Commit the re-basing atomically and guard stale tabs | Server function only: an owner's call re-bases a trip (all rows, shares, target, audit, room) or changes nothing; a stale tab's save is refused | Phase 2, Phase 1 (keys) |
| 4     | The dialog in Costs                                  | The owner clicks Change budget currency, sees the arithmetic, confirms, and the screen reads in the new currency                                | Phase 3                 |
| 5     | The edit sheet shows the currency read-only          | The sheet explains where the currency is changed and links there                                                                                | PR #779 merged, Phase 4 |

Five tickets for `afk-to-tickets`. Phases 2 and 3 are server functions no traveller can reach, so
they are demonstrated through tests or a direct call; they are not vertical slices and the spec
does not pretend otherwise (regrouping into preview-plus-dialog and commit-plus-confirm would put a
dialog in production that cannot confirm). The stale-tab guard ships with the commit, the change
that creates the race it guards. The `budget_items` migration rides with Phase 2, where it is first
read.

## 📋 Implementation Plan

### Phase 1 — Close the bare relabel, keep the empty trip open

1. Failing tests first: `updateTrip` with a different `currency` on a trip with each kind of priced
   row (expense, settlement, budget item, budget target, place, reservation, transport, stay, and a
   priced row whose `currency` is `NULL`) throws `CurrencyRefusalError` and writes nothing (trip row
   byte-identical, other fields of the save included); on a trip with none it applies the change
   together with another field; a priced row inserted between the read and the write makes the
   single statement fail with nothing applied (the test injects the row through a hook between
   `requireOwnedTrip` and the statement, asserts an error with `NOT NULL constraint failed:
trips.currency` is thrown and the trip row is byte-identical, `syncTripDays` not having run); a
   trip with `copy_pending_at` set counts as priced; a budget target of 0 counts as priced; one
   save setting a budget target and a new currency on an empty trip succeeds; an archived trip's
   currency change throws `TripArchivedError` while its other fields save as today; the same value
   is a no-op and sends no guard; `updateTripInputSchema` still accepts `currency`.
2. `src/lib/currency-refusals.ts` (keys, `currencyRefusalOf`); `classifyFailure` passes the keys
   through and `public.test.ts` pins them; `AUTHORED_ERROR_NAMES` is **not** edited.
3. `src/server/repos/trips.ts`: `CurrencyRefusalError`, `pricedRowsExistSql` / `pricedRowsExist`,
   and `updateTrip` writes a changed `currency` through the guarded single Drizzle statement
   (see "The writers that may change `trips.currency`"), mapping the constraint failure to the
   `shell.editTrip.currencyLocked` key.
4. The edit sheet's catch shows the resolved refusal instead of the generic error (one catch in
   `trip-actions.tsx`; rebase on develop first, PR #779 owns the file). Copy:
   `shell.editTrip.currencyLocked` in all 23 locales.
5. `CONTEXT.md`: **Budget currency** (the currency every figure of a trip adds up in; set at
   creation; on a trip with nothing priced, changed in the trip's edit; otherwise only by a
   re-basing once Phase 3 ships; _Avoid_: accounting currency). The **Re-basing** entry and the
   "frozen exchange rate" re-anchoring sentence in **Budget entry / expense** land with Phase 3, so
   the glossary does not describe a concept that may not exist for as long as the `04-S1` chain
   takes.
6. Docs grep: `trips.currency`, `updateTrip`, `MNY-06`, `accounting currency`, `budget currency`,
   `currency` in `docs/`, `.ai/`, `CONTEXT.md`.
7. Isolation: append a `describe` to `tenant-isolation.test.ts` for the `updateTrip` currency path:
   B's trip is `NotFoundError` and unchanged; a private trip A's caller is not on is
   `NotFoundError`; an editor and a viewer are refused; and the trip predicate: A's empty trip
   changes currency successfully while A's second trip and workspace B's trip each hold every
   priced kind (a `pricedRowsExist` that forgets `trip_id` fails this).

### Phase 2 — Preview what a re-basing would do (blocked by `04-S1`)

1. Confirm no `00-foundations` ticket or spec has added the `budget_items` source columns; then
   schema + `pnpm db:generate` + the migration test.
2. Tests first for `planRebase` and `netBalances` (pure): rules 1–8 on a fixture mixing an inherited
   row, a foreign receipt, a receipt already in the new base, a zero-decimal currency, an `exact`
   split, a `percentage` split, a zero amount, a planned item in a third currency; the statement
   count; the balance disclosure; parity of `netBalances` with `getMemberBalances`.
3. `previewCurrencyChange(scope, tripId, { to, rate? })`: guards (rule 9), the fixed-cost reads,
   `resolveRate`, `planRebase`; returns the structured result or refusal.
4. `previewCurrencyChangeFn` (`GET`) with the Zod above.
5. Isolation `describe` for the preview: B's trip is `NotFoundError`; a private trip the caller is
   not on is `NotFoundError`; editor, viewer, archived refused; no row written (B's footprint and A's
   second trip byte-identical); a rate in B's workspace never surfaces; a rate frozen on a private
   trip A's caller cannot read never surfaces as the `recent` rate.

### Phase 3 — Commit the re-basing atomically and guard stale tabs (blocked by Phase 2, Phase 1)

Touches paths held by other stages (`expenses.ts`, `fns/costs.ts`, `payment-dialog.tsx`); rebase on
develop first.

1. Tests first: the two invariants of acceptance 2; round trip; a settled trip; the ceiling at its
   boundary; `SHARE_ROWS_PER_STATEMENT` boundary; a failing last statement leaves the trip
   byte-identical; a write injected between read and commit rolls back; a double commit fails;
   owner-only; archived; a trip with `copy_pending_at` set is refused by the preview and the commit.
   Stale writers: each of the five with a mismatching `expectedTripCurrency`
   throws `CurrencyRefusalError` and writes no row; a matching or absent value behaves as today;
   booking sync (no assertion) still writes a foreign-currency line.
2. `changeTripCurrency`: re-read, recount, `planRebase`, build the statements with the predicated
   `UPDATE`s, the `CASE` guard last (old-currency test inside it, every subquery through
   `tenantFilter`), `runBatch`; map the constraint failure to the `rebaseChanged` key. Cite
   Cloudflare's D1 limits and the production plan in the ceiling constant's comment.
3. `changeTripCurrencyFn` (`POST`): call, `trail()` with the new action (action list and its test),
   `mirrorToRoom`.
4. `assertExpectedTripCurrency` in `trips.ts`, called from the five writers; the two keys added to
   `CURRENCY_REFUSAL_KEYS` and its pin; `costs.ts`: `createExpenseFn` / `updateExpenseFn` pass
   `body.currency`, `recordPaymentSchema` gains `expectedTripCurrency`, `payment-dialog.tsx` sends
   the loaded currency; the planned-item functions pass theirs. Grep every other caller of the five
   writers (seed, copy a trip, imports) and confirm none passes the new field.
5. `-costs/actions.ts` `run()` resolves a refusal key and, for `tripCurrencyChanged`, calls
   `router.invalidate()` while the dialog stays open. Copy: the two `costs.refusal.*` keys in all 23
   locales.
6. Isolation `describe` for the commit and the writers: A's re-basing of trip 1 leaves A's second
   trip and B's whole money footprint (trip row incl. `currency` and `budget_target_minor`,
   expenses, shares, settlements, budget items, priced places, reservations, transports, stays)
   byte-identical; commit on B's trip is `NotFoundError`; private trip, editor, viewer, archived
   refused with nothing written; an extra key is a parse error; a stale `expectedTripCurrency`
   writes zero rows and an expense id from workspace B in `updateExpense` is still not found.

### Phase 4 — The dialog in Costs (blocked by Phase 3)

Touches `screen.tsx`, held by other stages; rebase on develop first.

1. `currency-rebase-dialog.tsx` with all states and the behaviours in "UI/UX"; jsdom tests: every
   state renders, confirm disabled until the preview for the current pair has landed and on a
   refusal, Enter does not commit, the rate field is required and labelled when no rate resolves,
   its error is tied by `aria-describedby`, the result region is a live region, focus moves to retry
   after a failed commit, Escape is ignored while committing, a decimal comma parses, and no control
   reaches `server/`. An axe pass over each state in both themes.
2. `screen.tsx`: owner-only header button with `data-part="trip-currency-change"`, dialog state,
   `router.invalidate()` on success.
3. Copy: the `rebase.*` keys in all 23 locales, and `shell.editTrip.currencyLocked` re-worded in all
   23 locales to also point to the Costs tab ("…use Change budget currency on the Costs tab"), since
   Phase 5 may still be held up by #779 when this ships.

### Phase 5 — The edit sheet shows the currency read-only (blocked by PR #779 merged, Phase 4)

1. In the shared trip form, render the currency read-only with the pointer and link when editing;
   creation keeps the select. Test both modes.
2. Copy: `shell.editTrip.currencyReadonly` and `shell.editTrip.currencyLink` in all 23 locales.
   Rebase on develop first: #779 owns these files until it merges.

## Verification

The gate is `validation.commands` in `.ai/agentic.config.json`, run on the last commit of every
ticket's PR. No screenshot is compared anywhere (ADR 0016); the plan's `04-S5` frame sets are
history. What proves each ticket is vitest (`unit`, `ui`, the repository project on the
harness whose `db.batch()` rolls back as D1 does) plus the blind A/B pair from
`scripts/visual/capture.mjs` for Phases 4 and 5 (Phase 1's only visual change is the refusal in the edit sheet's error slot, reached in jsdom because no capture flag can fail a request): resting Costs, then `--click
'[data-part="trip-currency-change"]'` for the preview-loaded dialog, light and dark at
`360x800,1280x900,2560x1440`, `--auth`; the error and refusal states are reached in jsdom because no
capture flag can fail a request. The capture's `console` and `warnings` go into the PR body.

**Tenant-isolation test** — one `describe` per phase, appended to `tenant-isolation.test.ts`, as
listed in Phases 1, 2 and 3 above, so every ticket ships its own: no phase merges without the
isolation cases for the functions it adds.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                                     | Applied default                                                                                                                                                                                                                                                                                                                                                                                                                  | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | How does the spec relate to the unspecified `04-S1`?                                         | Hard dependency on the quoted contract; Phases 2–5 are an ordered chain behind the `04-S1` ticket; Phase 1 is independent. `04-S1`'s own spec wins if they diverge.                                                                                                                                                                                                                                                              | Decided by the software architect sub-agent (confidence high) and the product owner (high): `convertMinor`/`resolveRate` have one owner (`docs/SPEC.md` §8); a self-contained slice builds the same module twice.                                                                                                                                                                                                                                                                                   |
| 2   | The plan says `trips.currency` cannot change; it can.                                        | `updateTrip` refuses a different currency on a trip with any priced row (message key, not an authored class); on a trip with nothing priced it applies it in the same single guarded statement; `currency` stays in both input schemas; the edit sheet goes read-only in Phase 5.                                                                                                                                                | First decided by the security and tenancy reviewer (high) as "refuse, no empty-trip exception"; **revised in review round 1** at the product owner's (high) and the traveller's request, because the tenancy objection (a `NULL`-currency priced row makes "empty" easy to misjudge) is met by the precise `pricedRowsExist` test plus the single-statement guard.                                                                                                                                  |
| 3   | What can an owner do with a wrong currency before Phase 3 ships?                             | On an empty trip, fix it in the edit sheet. On a trip with prices: nothing, with a refusal that says so; reversible.                                                                                                                                                                                                                                                                                                             | Product owner's review-1 condition: the `04-S1` chain may be long, and the common mistake is made at creation.                                                                                                                                                                                                                                                                                                                                                                                      |
| 4   | Shares of an `exact` split under a re-basing?                                                | Distribute the new amount in proportion to the old `share_minor` through `computeShares` (method `shares`); `shares` passes weight, `percentage` passes the stored weight as `percentage`; remainder in participant order.                                                                                                                                                                                                       | Decided by the software architect sub-agent (confidence high): the stored weight of an exact row is 1, so the plan's rule would silently make it an equal split; one splitter only. The `percentage` detail is from review round 1 (product owner, tenancy).                                                                                                                                                                                                                                        |
| 5   | A row whose `original_currency` is the new base?                                             | `amount = original`, `rate = 1`, triple kept.                                                                                                                                                                                                                                                                                                                                                                                    | Decided by the software architect sub-agent (confidence high): the typed figure is the truth, and the round-trip rule only holds if it is used verbatim.                                                                                                                                                                                                                                                                                                                                            |
| 6   | Which rate converts a row?                                                                   | One `k` for the batch; `r × k` for every row (an inherited row has `r = 1` after pinning); never a per-row lookup.                                                                                                                                                                                                                                                                                                               | Decided by the software architect sub-agent (confidence high): two rates in one batch would not net to zero; re-resolving would overwrite frozen rates.                                                                                                                                                                                                                                                                                                                                             |
| 7   | `trips.budget_target_minor`?                                                                 | Converted with `k` through `convertMinor`; old and new shown in the preview and recorded in the audit row; no source kept.                                                                                                                                                                                                                                                                                                       | Decided by the product owner sub-agent (confidence high): clearing is unrecoverable (no screen sets it), keeping it mislabels it, three more columns is a larger migration for a planning figure. The security reviewer asked that a person know of it; `afk-decide` §5 does not reserve money policy for a person, so it is applied and disclosed here.                                                                                                                                            |
| 8   | Settled trips and rounding?                                                                  | Bounded rounding, disclosed: the preview names the largest movement and each person's leftover on a previously zero ledger; the plan's "settled trip stays settled" and "one unit per member" are dropped; no dust handling in `suggestSettlements`.                                                                                                                                                                             | Decided by the product owner sub-agent (confidence medium): inventing balancing rows breaks the stage's title, refusing settled trips removes the safest corrections, the owner must see a phantom debt before confirming. Applied and disclosed as for row 7.                                                                                                                                                                                                                                      |
| 9   | Stale writers?                                                                               | An optional `expectedTripCurrency` asserted by the five client-originated writers (incl. both planned-item writers), keyed on the client's belief about the trip, refused with a message key; the payment schema field is named `expectedTripCurrency`; booking sync passes nothing; required next release; the residual window is named, not closed.                                                                            | Decided by the security and tenancy reviewer (confidence medium) and the architect (medium); review round 1 widened it to planned items, renamed the payment field (`04-S1` will want `currency`) and replaced the false "caught by one or the other" claim with the named window.                                                                                                                                                                                                                  |
| 10  | Size of a re-basing?                                                                         | One atomic batch, `MAX_REBASE_STATEMENTS = 900` enforced in preview and again in commit, no chunking; share statements capped at `SHARE_ROWS_PER_STATEMENT` (three bound parameters per row); 100 statements of headroom; the D1 figure and production plan are checked by the implementer.                                                                                                                                      | Decided by the architect (confidence high), the product owner (medium) and the tenancy reviewer (medium); review round 1 corrected the parameter count (three, not two) and the headroom. The limit could not be verified offline, so it is conservative and flagged.                                                                                                                                                                                                                               |
| 11  | The read-then-write race?                                                                    | Predicated per-row `UPDATE`s plus a last `UPDATE trips` whose `CASE` (old-currency test **inside** it, tenant-filtered subqueries, batch-time scan of every row of the trip) raises a `NOT NULL` failure, rolling the batch back.                                                                                                                                                                                                | Decided by the security and tenancy reviewer (confidence medium); review round 1 (architect, tenancy) moved the old-currency test out of the `WHERE` (a double commit would have matched zero rows and reported success) and required the tenant filter on every subquery.                                                                                                                                                                                                                          |
| 12  | Who may re-base, and when?                                                                   | Owner only (`assertTripRole(['owner'])` after `requireWritableTrip`), on a non-archived trip, preview and commit alike, inside the repository.                                                                                                                                                                                                                                                                                   | Decided by the security and tenancy reviewer (confidence high): currency is trip metadata (`CONTEXT.md`, PRD #104 decision 6); archive is a record not to be rewritten; the preview may become a billed provider call.                                                                                                                                                                                                                                                                              |
| 13  | Ledger rows and planned items in a currency that is neither old nor new?                     | Refuse the re-basing with the count; a row already in `new` is kept as typed.                                                                                                                                                                                                                                                                                                                                                    | Default applied (refusal beats corruption): `k` is not a rate for a third currency; flagged by the product owner and tenancy reviewers; review round 1 added planned items, whose `currency` is free.                                                                                                                                                                                                                                                                                               |
| 14  | Prices on reservations, transports, stays with a `NULL` currency?                            | Pinned to `old` with places (rule 7), never converted; the preview says they stay in `old`.                                                                                                                                                                                                                                                                                                                                      | Raised by the product owner and tenancy reviewers: `NULL` renders as the trip's currency, so only pinning keeps them honest; the traveller reviewer asked that the dialog say so.                                                                                                                                                                                                                                                                                                                   |
| 15  | Where is the entry point?                                                                    | A header action on Costs, owner only, not `costs-toolbar.tsx` (the filter bar).                                                                                                                                                                                                                                                                                                                                                  | Default applied from the code: the toolbar is the expense filter bar; the header already hosts the screen's actions.                                                                                                                                                                                                                                                                                                                                                                                |
| 16  | What replaces the plan's screenshot-baseline verification?                                   | Vitest plus the blind A/B pair through `capture.mjs`; no `e2e/__screenshots__` and no `budget-and-currencies.visual.spec.ts`.                                                                                                                                                                                                                                                                                                    | ADR 0016 removed the pixel gate; one defensible answer in the repository, so no specialist was needed.                                                                                                                                                                                                                                                                                                                                                                                              |
| 17  | Rate bounds and where the rate comes from at commit?                                         | `1e-7 ≤ rate ≤ 1e7`; the commit takes the previewed rate as input and does not look one up; `resolveRate` is called only in the preview.                                                                                                                                                                                                                                                                                         | Default applied: a rate the owner has seen is the one that is written; the bounds admit VND ↔ KWD.                                                                                                                                                                                                                                                                                                                                                                                                  |
| 18  | Refusal copy: catalogue or authored?                                                         | **Message keys** (one `CurrencyRefusalError`, a closed `CURRENCY_REFUSAL_KEYS` list pinned by `public.test.ts`, resolved on the client with `t()`); `AUTHORED_ERROR_NAMES`, `docs/SPEC.md` §9 and `public.ts` are not edited; the preview returns structured refusals.                                                                                                                                                           | **Corrects the first draft**, which added three authored classes and called it existing practice. Decided by the software architect (review round 1, condition 1) and the traveller (blocker): §9 rule 10 closes the list and a new refusal travels as a message key, so it reaches a Polish phone in Polish.                                                                                                                                                                                       |
| 19  | Authorisation of the three out-of-scope defects found on the way?                            | Reported as follow-ups, not built; the cross-trip expense edit/delete is to be filed as a `security` issue with this spec's PR.                                                                                                                                                                                                                                                                                                  | Default applied (surgical changes): separate concepts with their own owners; the tenancy and product-owner reviewers confirmed the first one in the code.                                                                                                                                                                                                                                                                                                                                           |
| 20  | Phasing: stale guard with the commit, an ordered chain, no "vertical slice" claim?           | Five phases; the stale-tab guard ships with the commit; 3 blocked by 2 and 1, 4 by 3, 5 by #779 and 4; Phases 2 and 3 are stated to be server-only; one isolation `describe` per phase; the `budget_items` migration is an explicit departure from the plan's `00-foundations` filing.                                                                                                                                           | Product owner's review-1 conditions 1, 3, 4, 5 (confidence high): a guard shipped alone cannot be shown to a user, and the departure from the plan needed its own row and an ownership check. Tenancy review-1 condition 1 (isolation per phase).                                                                                                                                                                                                                                                   |
| 21  | One name for the field in the UI?                                                            | "Budget currency" (the trip form's existing label), in the button, title, toast and pointer; "accounting currency" stays an engineering term; the rate field has a visible label, inverse rate and decimal-comma input; preview on input (debounced), never on blur; commit exactly what was previewed.                                                                                                                          | Default applied after the traveller (revise, high) and accessibility (conditions 1–6, medium) reviews: one name translates once, "adds up in" is an idiom, and a blur-triggered preview races the confirm tap on a phone.                                                                                                                                                                                                                                                                           |
| 22  | Where is the `budget_items` migration filed, given the plan files it under `00-foundations`? | In this stage's Phase 2, after the ticket checks that no `00-foundations` ticket or spec has added the same columns; if one has, the migration is dropped and theirs consumed.                                                                                                                                                                                                                                                   | Departure from the plan flagged by the product owner (round 1, condition 5): no spec or ticket adds the columns at this commit and the re-basing is their first reader; the ownership check keeps `docs/SPEC.md` §8's one owner per concept.                                                                                                                                                                                                                                                        |
| 23  | The empty-trip path: a pending trip copy, archived trips, when the guard applies             | `copy_pending_at IS NOT NULL` counts as priced (in the guard and in Phase 3's stale test, with a preview refusal); a currency change on an archived trip is refused with `TripArchivedError`, other fields unchanged; the guard applies only when the incoming currency differs; ABORT conflict resolution; a target of 0 counts as priced.                                                                                      | Security and tenancy reviewer (round 2, conditions 1–3, medium) and the product owner (round 2, condition 2): a copy in progress looks empty and its places would be silently relabelled; `requireOwnedTrip` does not check the archive flag, so the rule had to be stated; an unconditional guard would refuse every save on a priced trip.                                                                                                                                                        |
| 24  | A dropped response after a commit, and a stale dialog after a refusal                        | After a non-refusal failure the dialog re-reads the trip and shows success if its currency is already `to`; the commit has a 30-second timeout; a refused stale save keeps the typed digits, marks the amount invalid and resets the currency control to the trip's new currency; the refusal names `{to}`.                                                                                                                      | Traveller (round 2, conditions 1–2, medium): "nothing was changed" would be false after a lost success, and the expense dialog would otherwise flip to a foreign amount silently or re-label a payment's digits.                                                                                                                                                                                                                                                                                    |
| 25  | Final panel verdicts (round 2 of at most two)                                                | Product owner: approve with conditions (high). Software architect: approve with conditions (medium). Security and tenancy reviewer: approve with conditions (medium). Accessibility specialist: approve with conditions (high). Traveller / UX: approve with conditions (medium; round 1 was **revise**). Every condition of both rounds is applied in this spec; none is open and no specialist answered **revise** in round 2. | `afk-plan-to-spec` § 5. The security reviewer and the product owner asked whether a person must confirm the money-policy rows 7 and 8; `afk-decide` § 5 does not reserve money policy for a person, so they are applied and disclosed (preview and audit row). The security reviewer also asked that the cross-trip expense edit/delete be filed as a `security` issue before this PR merges: this skill files no tickets, so the PR body names it for the person merging and for `afk-to-tickets`. |
