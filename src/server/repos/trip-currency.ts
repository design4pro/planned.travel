/**
 * Re-basing a trip's budget currency: what it would do, before anything is written.
 *
 * A trip's **budget currency** (`trips.currency`) is the currency every share, balance, total and
 * settlement of the trip is denominated in. Changing it safely is a *re-basing*, not a relabel:
 * every figure in the old currency is converted once, at one rate the owner has seen and
 * confirmed, while the amount each traveller typed stays readable in the source columns
 * (`original_amount_minor`, `original_currency`, `exchange_rate`). This module is the one owner of
 * that rule.
 *
 * Two halves:
 *
 * - **The pure core.** {@link planRebase} is handed the rows of a trip, read once, and answers
 *   either the plan - every row as it would be written, the counts, the statement count, the
 *   budget target and the balances before and after - or a structured refusal. {@link netBalances}
 *   is the balance formula over plain rows. The commit that comes after this module calls the very
 *   same functions, so what the owner confirms is what is written and the two cannot differ.
 * - **The thin shell.** {@link previewCurrencyChange} guards the caller, reads the rows with a fixed
 *   number of queries (one per table, never one per expense), asks `resolveRate` for the one rate
 *   and returns the plan as data. It writes nothing.
 *
 * Refusals are **data**, never thrown messages: the dialog renders each one from the locale
 * catalogue (`docs/SPEC.md` §9), so a refusal that travelled as an `Error` message would reach a
 * Polish phone in English.
 *
 * The conversion is `convertMinor` (`src/lib/money.ts`) and the rate lookup is `resolveRate`
 * (`./rates`); neither is rebuilt here (`docs/SPEC.md` §8, one concept one owner).
 */

import { asc, count, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { convertMinor } from '#/lib/money'
import {
  SPLIT_METHODS,
  budgetItems,
  dayAccommodations,
  expenseShares,
  expenses,
  places,
  reservations,
  settlements,
  transports,
} from '#/server/db/schema'
import { tenantFilter } from './base'
import { MAX_BOUND_PARAMETERS } from './batch'
import { computeShares, settlementsFromBalances } from './expenses'
import { resolveRate } from './rates'
import { assertTripRole, requireWritableTrip } from './trips'
import { currencySchema, idSchema } from './validation'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'
import type { TenantScope, TenantTable } from './base'
import type { SplitParticipantInput } from './expenses'

/* -------------------------------------------------------------------------------------------------
 * Limits
 * ---------------------------------------------------------------------------------------------- */

/**
 * The most statements one re-basing may put in its single atomic batch, preview and commit alike.
 *
 * A re-basing is one `db.batch()` because a chunked one is not atomic: a half-re-based trip would
 * be a reachable state. That is an exception to `docs/SPEC.md` §5 ("keep D1 transactions small"),
 * taken deliberately and bounded by this ceiling. It sits under D1's per-invocation query limit
 * (1,000 on the paid plan, every statement of a batch counting), leaving 100 for the rest of the
 * invocation: auth, the guards, the pre-reads, the audit row and the room mirror. In a traveller's
 * terms it admits a trip of roughly 400 logged expenses and payments together.
 *
 * The preview's figure is advisory; the commit enforces this again before it builds the batch.
 * The commit's author checks the limit against Cloudflare's current page and the plan production
 * runs on, and lowers the constant if the page says less.
 */
export const MAX_REBASE_STATEMENTS = 900

/**
 * How many share rows one `UPDATE` carries. A share statement binds **three** parameters per row
 * (`WHEN id = ? THEN ?` and the id again in the `IN` list) plus a handful of fixed ones (workspace,
 * trip, expense), and D1 refuses more than {@link MAX_BOUND_PARAMETERS}: 31 rows at 100.
 */
export const SHARE_ROWS_PER_STATEMENT = Math.floor(
  (MAX_BOUND_PARAMETERS - 6) / 3,
)

/**
 * The statements a re-basing always runs whatever it converts: one set-based pin of the reference
 * prices on each of places, reservations, transports and stays, and the final `trips` statement.
 */
const FIXED_STATEMENTS = 5

/** The bounds of a rate (`1 old = rate new`): wide enough for VND to KWD and back, narrow enough to catch a typo. */
export const MIN_REBASE_RATE = 1e-7
export const MAX_REBASE_RATE = 1e7

export const rebaseRateSchema = z
  .number()
  .finite()
  .min(MIN_REBASE_RATE)
  .max(MAX_REBASE_RATE)

/** What the owner asks the preview: the new currency, and optionally the rate they typed. */
export const previewCurrencyChangeInput = z.strictObject({
  to: currencySchema,
  rate: rebaseRateSchema.optional(),
})
export type PreviewCurrencyChangeInput = z.input<
  typeof previewCurrencyChangeInput
>

/**
 * The request as the server function receives it: the trip as well. Strict, so an extra key (say a
 * list of expense ids to re-base) is a parse error and not a quiet instruction.
 */
export const previewCurrencyChangeRequest = previewCurrencyChangeInput.extend({
  tripId: idSchema,
})

/* -------------------------------------------------------------------------------------------------
 * Shapes
 * ---------------------------------------------------------------------------------------------- */

/** The columns that make a figure and what the traveller typed to get it. */
interface MoneyColumns {
  readonly amountMinor: number
  readonly currency: string
  readonly originalAmountMinor: number | null
  readonly originalCurrency: string | null
  readonly exchangeRate: number | null
}

/** A logged expense, as read for a re-basing. */
export interface RebaseExpense {
  readonly id: string
  readonly amountMinor: number
  readonly currency: string
  readonly originalAmountMinor: number | null
  readonly originalCurrency: string | null
  readonly exchangeRate: number | null
  readonly splitMethod: string
  readonly paidBy: string | null
}

/** One traveller's share of an expense. Rows come in the order they were stored. */
export interface RebaseShare {
  readonly id: string
  readonly expenseId: string
  readonly userId: string
  readonly shareMinor: number
  readonly weight: number
}

/** A payment between two travellers (a `settlements` row). */
export interface RebasePayment {
  readonly id: string
  readonly fromUserId: string
  readonly toUserId: string
  readonly amountMinor: number
  readonly currency: string
  readonly originalAmountMinor: number | null
  readonly originalCurrency: string | null
  readonly exchangeRate: number | null
}

/** A planned item (a `budget_items` row); its figure is `plannedAmountMinor`. */
export interface RebasePlannedItem {
  readonly id: string
  readonly plannedAmountMinor: number
  readonly currency: string
  readonly originalAmountMinor: number | null
  readonly originalCurrency: string | null
  readonly exchangeRate: number | null
}

/** Everything a plan is made from: the trip's money rows, read once. */
export interface RebaseSnapshot {
  readonly expenses: ReadonlyArray<RebaseExpense>
  readonly shares: ReadonlyArray<RebaseShare>
  readonly payments: ReadonlyArray<RebasePayment>
  readonly plannedItems: ReadonlyArray<RebasePlannedItem>
  /** `trips.budget_target_minor`: a figure in the trip's currency with no currency column. */
  readonly budgetTargetMinor: number | null
  /** Priced places, bookings, transports and stays whose currency is unset (rule 7). */
  readonly pinnedPrices: number
}

/** A figure after a re-basing: the amount and its code move together, and the typed figure is kept. */
export interface RebasedMoney {
  readonly amountMinor: number
  readonly currency: string
  readonly originalAmountMinor: number
  readonly originalCurrency: string
  readonly exchangeRate: number
}

export interface RebasedRow extends RebasedMoney {
  readonly id: string
}

export interface RebasedShare {
  readonly id: string
  readonly userId: string
  readonly shareMinor: number
}

export interface RebasedExpense extends RebasedRow {
  readonly shares: ReadonlyArray<RebasedShare>
}

export interface RebaseCounts {
  readonly expenses: number
  readonly settlements: number
  readonly budgetItems: number
  readonly shareRows: number
  readonly pinnedPrices: number
}

export interface MemberNet {
  readonly userId: string
  /** Positive: the trip owes them. Negative: they owe the trip. */
  readonly balanceMinor: number
}

/** Who would owe whom how much once everybody had been at zero. Participant ids, never names. */
export interface Leftover {
  readonly userId: string
  readonly otherUserId: string
  readonly amountMinor: number
}

export interface RebaseBalances {
  readonly before: ReadonlyArray<MemberNet>
  readonly after: ReadonlyArray<MemberNet>
  /** The largest distance of a member's new balance from `round(rate × old balance)`. */
  readonly maxMovementMinor: number
  /** Non-empty only when everybody was at zero and somebody would not be. */
  readonly leftovers: ReadonlyArray<Leftover>
}

export interface RebaseFigure {
  readonly amountMinor: number
  readonly currency: string
}

export interface RebasePlan {
  readonly from: string
  readonly to: string
  /** `1 from = rate to`; null when nothing needs one. */
  readonly rate: number | null
  readonly expenses: ReadonlyArray<RebasedExpense>
  readonly payments: ReadonlyArray<RebasedRow>
  readonly plannedItems: ReadonlyArray<RebasedRow>
  readonly counts: RebaseCounts
  readonly statements: number
  readonly budgetTarget: {
    readonly before: number
    readonly after: number
  } | null
  /** The first priced row as the figure typed and what it will count as. */
  readonly example: {
    readonly original: RebaseFigure
    readonly converted: RebaseFigure
  } | null
  readonly balances: RebaseBalances
}

/**
 * Why a re-basing is refused. `same-currency` and `copy-pending` are decided by the preview from
 * the trip row; the rest by {@link planRebase}.
 */
export type RebaseRefusal =
  | { readonly kind: 'same-currency' }
  | { readonly kind: 'copy-pending' }
  | { readonly kind: 'no-rate' }
  /** Entries in a currency that is neither the old nor the new one: `k` is no rate for them. */
  | { readonly kind: 'unconverted-rows'; readonly count: number }
  /** Expenses whose split cannot be recomputed (every old share is zero). */
  | { readonly kind: 'unsplittable'; readonly count: number }
  | { readonly kind: 'amount-out-of-range' }
  | {
      readonly kind: 'too-large'
      readonly statements: number
      readonly ceiling: number
    }

export type RebaseOutcome =
  | { readonly kind: 'planned'; readonly plan: RebasePlan }
  | { readonly kind: 'refused'; readonly refusal: RebaseRefusal }

/* -------------------------------------------------------------------------------------------------
 * Counting
 * ---------------------------------------------------------------------------------------------- */

export function countRebase(snapshot: RebaseSnapshot): RebaseCounts {
  return {
    expenses: snapshot.expenses.length,
    settlements: snapshot.payments.length,
    budgetItems: snapshot.plannedItems.length,
    shareRows: snapshot.shares.length,
    pinnedPrices: snapshot.pinnedPrices,
  }
}

/**
 * How many statements the batch for this trip holds: one `UPDATE` per expense, payment and planned
 * item, one `UPDATE` per {@link SHARE_ROWS_PER_STATEMENT} share rows of each expense, and the
 * {@link FIXED_STATEMENTS} every re-basing runs. The preview and the commit both count with this.
 */
export function countRebaseStatements(snapshot: RebaseSnapshot): number {
  const sharesOf = new Map<string, number>()
  for (const row of snapshot.shares) {
    sharesOf.set(row.expenseId, (sharesOf.get(row.expenseId) ?? 0) + 1)
  }
  let statements =
    snapshot.expenses.length +
    snapshot.payments.length +
    snapshot.plannedItems.length +
    FIXED_STATEMENTS
  for (const row of snapshot.expenses) {
    statements += Math.ceil(
      (sharesOf.get(row.id) ?? 0) / SHARE_ROWS_PER_STATEMENT,
    )
  }
  return statements
}

/* -------------------------------------------------------------------------------------------------
 * Balances
 * ---------------------------------------------------------------------------------------------- */

/** The rows a balance is netted from. A subset of the snapshot, so both the old and new rows fit. */
export interface BalanceRows {
  readonly expenses: ReadonlyArray<{
    readonly paidBy: string | null
    readonly amountMinor: number
  }>
  readonly shares: ReadonlyArray<{
    readonly userId: string
    readonly shareMinor: number
  }>
  readonly payments: ReadonlyArray<{
    readonly fromUserId: string
    readonly toUserId: string
    readonly amountMinor: number
  }>
}

/**
 * Per-member balance: `paid − share + payments sent − payments received`, the formula
 * `getMemberBalances` (`./expenses`) reads from the database, over plain rows. A parity test pins
 * the two together on one fixture. Biggest creditor first, then by id, so the order is the same
 * whichever side of a comparison it comes from.
 */
export function netBalances(rows: BalanceRows): Array<MemberNet> {
  const totals = new Map<string, number>()
  const add = (userId: string | null, minor: number) => {
    if (userId !== null) {
      totals.set(userId, (totals.get(userId) ?? 0) + minor)
    }
  }
  for (const row of rows.expenses) {
    add(row.paidBy, row.amountMinor)
  }
  for (const row of rows.shares) {
    add(row.userId, -row.shareMinor)
  }
  for (const row of rows.payments) {
    add(row.fromUserId, row.amountMinor)
    add(row.toUserId, -row.amountMinor)
  }
  return [...totals]
    .map(([userId, balanceMinor]) => ({ userId, balanceMinor }))
    .sort(
      (left, right) =>
        right.balanceMinor - left.balanceMinor ||
        left.userId.localeCompare(right.userId),
    )
}

function balanceDisclosure(
  before: ReadonlyArray<MemberNet>,
  after: ReadonlyArray<MemberNet>,
  rate: number,
  from: string,
  to: string,
): RebaseBalances {
  const beforeOf = new Map(before.map((row) => [row.userId, row.balanceMinor]))
  const afterOf = new Map(after.map((row) => [row.userId, row.balanceMinor]))
  let maxMovementMinor = 0
  for (const userId of new Set([...beforeOf.keys(), ...afterOf.keys()])) {
    const expected = convertMinor(beforeOf.get(userId) ?? 0, rate, from, to)
    const movement = Math.abs((afterOf.get(userId) ?? 0) - expected)
    maxMovementMinor = Math.max(maxMovementMinor, movement)
  }
  const settledBefore = before.every((row) => row.balanceMinor === 0)
  const owesAfter = after.some((row) => row.balanceMinor !== 0)
  return {
    before,
    after,
    maxMovementMinor,
    leftovers:
      settledBefore && owesAfter
        ? settlementsFromBalances(after).map((debt) => ({
            userId: debt.fromUserId,
            otherUserId: debt.toUserId,
            amountMinor: debt.amountMinor,
          }))
        : [],
  }
}

/* -------------------------------------------------------------------------------------------------
 * Converting one figure
 * ---------------------------------------------------------------------------------------------- */

/** A row's typed figure: what it was entered as, in which currency, at which frozen rate. */
interface Source {
  readonly originalAmountMinor: number
  readonly originalCurrency: string
  readonly exchangeRate: number
}

/**
 * The source of a row in the trip's old currency. A row that carries a whole triple keeps it; one
 * that inherited the trip's currency has none, and is pinned from itself (rule 1) so the typed
 * figure is not lost when its amount moves.
 */
function sourceOf(row: MoneyColumns, from: string): Source {
  const { originalAmountMinor, originalCurrency, exchangeRate } = row
  if (
    originalAmountMinor !== null &&
    originalCurrency !== null &&
    exchangeRate !== null &&
    Number.isFinite(exchangeRate) &&
    exchangeRate > 0
  ) {
    return { originalAmountMinor, originalCurrency, exchangeRate }
  }
  return {
    originalAmountMinor: row.amountMinor,
    originalCurrency: from,
    exchangeRate: 1,
  }
}

/**
 * One row, re-based (rules 2, 4 and 5), or `null` when its currency is neither `from` nor `to` and
 * no rate here can convert it.
 *
 * Throws `RangeError` (from `convertMinor`) when the result is not a safe integer.
 */
function rebaseMoney(
  row: MoneyColumns,
  rate: number,
  from: string,
  to: string,
): RebasedMoney | null {
  if (row.currency === to) {
    // Already in the new currency, so the figure is the truth: nothing to convert.
    return {
      amountMinor: row.amountMinor,
      currency: to,
      originalAmountMinor: row.amountMinor,
      originalCurrency: to,
      exchangeRate: 1,
    }
  }
  if (row.currency !== from) {
    return null
  }
  const source = sourceOf(row, from)
  const typed = {
    currency: to,
    originalAmountMinor: source.originalAmountMinor,
    originalCurrency: source.originalCurrency,
  }
  if (source.originalCurrency === to) {
    // Typed in the currency the trip is moving to: used verbatim, so a round trip does not drift.
    return {
      ...typed,
      amountMinor: source.originalAmountMinor,
      exchangeRate: 1,
    }
  }
  if (source.originalAmountMinor === 0) {
    return { ...typed, amountMinor: 0, exchangeRate: source.exchangeRate }
  }
  const combined = source.exchangeRate * rate
  return {
    ...typed,
    amountMinor: convertMinor(
      source.originalAmountMinor,
      combined,
      source.originalCurrency,
      to,
    ),
    exchangeRate: combined,
  }
}

const splitMethodSchema = z.enum(SPLIT_METHODS)

/**
 * The shares of one expense for its new amount, through the one splitter (rule 6).
 *
 * `percentage` stores its percentage as the weight and `computeShares` reads it as `percentage`;
 * `exact` stores a weight of 1, so it is re-run as `shares` weighted by the old share, which keeps
 * it proportional. Remainder units go in the order the rows were stored. Returns `null` when the
 * split cannot be recomputed. The weight and the settled flag of a row are not touched: only the
 * amount moves.
 */
function rebaseShares(
  method: string,
  amountMinor: number,
  rows: ReadonlyArray<RebaseShare>,
): Array<RebasedShare> | null {
  if (amountMinor === 0 || rows.length === 0) {
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      shareMinor: 0,
    }))
  }
  const parsed = splitMethodSchema.safeParse(method)
  if (!parsed.success) {
    return null
  }
  const participants = rows.map((row): SplitParticipantInput => {
    switch (parsed.data) {
      case 'percentage':
        return { userId: row.userId, percentage: row.weight }
      case 'exact':
        return { userId: row.userId, weight: row.shareMinor }
      case 'shares':
        return { userId: row.userId, weight: row.weight }
      case 'equal':
        return { userId: row.userId }
    }
  })
  try {
    return computeShares(
      amountMinor,
      parsed.data === 'exact' ? 'shares' : parsed.data,
      participants,
    ).map((share, index) => ({
      id: rows[index]?.id ?? '',
      userId: share.userId,
      shareMinor: share.shareMinor,
    }))
  } catch {
    return null
  }
}

/* -------------------------------------------------------------------------------------------------
 * The plan
 * ---------------------------------------------------------------------------------------------- */

/** How many entries are in a currency that is neither `from` nor `to`. */
function unconvertedCount(
  snapshot: RebaseSnapshot,
  from: string,
  to: string,
): number {
  const foreign = (row: { readonly currency: string }) =>
    row.currency !== from && row.currency !== to
  return (
    snapshot.expenses.filter(foreign).length +
    snapshot.payments.filter(foreign).length +
    snapshot.plannedItems.filter(foreign).length
  )
}

/**
 * A re-based row, for a caller that has already refused every entry in a third currency: reaching
 * `null` here is a defect in this module, not a state a trip can be in.
 */
function converted(money: RebasedMoney | null): RebasedMoney {
  if (money === null) {
    throw new Error('An entry in a third currency reached the conversion.')
  }
  return money
}

/**
 * Whether the plan needs a rate at all: any priced row or a budget target to convert. A trip with
 * only reference prices to pin needs none. The preview asks before it looks a rate up and the plan
 * asks before it refuses, so the two cannot disagree.
 */
function needsRate(snapshot: RebaseSnapshot): boolean {
  return (
    snapshot.expenses.length +
      snapshot.payments.length +
      snapshot.plannedItems.length >
      0 || snapshot.budgetTargetMinor !== null
  )
}

function refused(refusal: RebaseRefusal): RebaseOutcome {
  return { kind: 'refused', refusal }
}

function firstExample(
  rows: ReadonlyArray<RebasedMoney>,
  to: string,
): RebasePlan['example'] {
  const priced = rows.filter(
    (candidate) =>
      candidate.amountMinor > 0 && candidate.originalAmountMinor > 0,
  )
  // A figure typed in the new currency is kept, not converted, so it shows nothing of the rate the
  // owner is about to confirm: prefer a row that moves.
  const row =
    priced.find((candidate) => candidate.originalCurrency !== to) ?? priced[0]
  return row === undefined
    ? null
    : {
        original: {
          amountMinor: row.originalAmountMinor,
          currency: row.originalCurrency,
        },
        converted: { amountMinor: row.amountMinor, currency: to },
      }
}

/**
 * Plans the re-basing of `snapshot` from `from` to `to` at `rate` (`1 from = rate to`), or refuses.
 *
 * Pure: it reads nothing and writes nothing, and the preview and the commit call it with the same
 * rows. Refusals are checked cheapest first and from what the owner cannot fix by typing a rate
 * to what they can: entries in a third currency, a trip over the statement ceiling, no rate, then
 * the arithmetic that needs one (a split that cannot be recomputed, an amount that does not fit a
 * safe integer). A refusal writes nothing, by construction: there is no plan to write.
 */
export function planRebase(
  snapshot: RebaseSnapshot,
  options: {
    readonly from: string
    readonly to: string
    readonly rate: number | null
  },
): RebaseOutcome {
  const { from, to, rate } = options

  const unconverted = unconvertedCount(snapshot, from, to)
  if (unconverted > 0) {
    return refused({ kind: 'unconverted-rows', count: unconverted })
  }
  const statements = countRebaseStatements(snapshot)
  if (statements > MAX_REBASE_STATEMENTS) {
    return refused({
      kind: 'too-large',
      statements,
      ceiling: MAX_REBASE_STATEMENTS,
    })
  }
  if (needsRate(snapshot) && rate === null) {
    return refused({ kind: 'no-rate' })
  }
  const counts = countRebase(snapshot)
  if (rate === null) {
    // Nothing is priced but reference prices: they are pinned, never converted, and need no rate.
    return {
      kind: 'planned',
      plan: {
        from,
        to,
        rate: null,
        expenses: [],
        payments: [],
        plannedItems: [],
        counts,
        statements,
        budgetTarget: null,
        example: null,
        balances: balanceDisclosure([], [], 1, from, to),
      },
    }
  }

  try {
    const sharesOf = new Map<string, Array<RebaseShare>>()
    for (const row of snapshot.shares) {
      sharesOf.set(row.expenseId, [...(sharesOf.get(row.expenseId) ?? []), row])
    }

    let unsplittable = 0
    const rebasedExpenses: Array<RebasedExpense> = []
    for (const row of snapshot.expenses) {
      const money = converted(rebaseMoney(row, rate, from, to))
      const shares = rebaseShares(
        row.splitMethod,
        money.amountMinor,
        sharesOf.get(row.id) ?? [],
      )
      if (shares === null) {
        unsplittable += 1
        continue
      }
      rebasedExpenses.push({ id: row.id, ...money, shares })
    }
    if (unsplittable > 0) {
      return refused({ kind: 'unsplittable', count: unsplittable })
    }

    const rebasedPayments = snapshot.payments.map((row) => ({
      id: row.id,
      ...converted(rebaseMoney(row, rate, from, to)),
    }))
    const rebasedItems = snapshot.plannedItems.map((row) => ({
      id: row.id,
      ...converted(
        rebaseMoney(
          { ...row, amountMinor: row.plannedAmountMinor },
          rate,
          from,
          to,
        ),
      ),
    }))

    const budgetTarget =
      snapshot.budgetTargetMinor === null
        ? null
        : {
            before: snapshot.budgetTargetMinor,
            after: convertMinor(snapshot.budgetTargetMinor, rate, from, to),
          }

    const balances = balanceDisclosure(
      netBalances(snapshot),
      netBalances({
        expenses: rebasedExpenses.map((row, index) => ({
          paidBy: snapshot.expenses[index]?.paidBy ?? null,
          amountMinor: row.amountMinor,
        })),
        shares: rebasedExpenses.flatMap((row) => row.shares),
        payments: rebasedPayments.map((row, index) => ({
          fromUserId: snapshot.payments[index]?.fromUserId ?? '',
          toUserId: snapshot.payments[index]?.toUserId ?? '',
          amountMinor: row.amountMinor,
        })),
      }),
      rate,
      from,
      to,
    )

    return {
      kind: 'planned',
      plan: {
        from,
        to,
        rate,
        expenses: rebasedExpenses,
        payments: rebasedPayments,
        plannedItems: rebasedItems,
        counts,
        statements,
        budgetTarget,
        example:
          firstExample(
            [...rebasedExpenses, ...rebasedPayments, ...rebasedItems],
            to,
          ) ??
          (budgetTarget !== null && budgetTarget.before > 0
            ? {
                original: { amountMinor: budgetTarget.before, currency: from },
                converted: { amountMinor: budgetTarget.after, currency: to },
              }
            : null),
        balances,
      },
    }
  } catch (error) {
    if (error instanceof RangeError) {
      return refused({ kind: 'amount-out-of-range' })
    }
    throw error
  }
}

/* -------------------------------------------------------------------------------------------------
 * The preview
 * ---------------------------------------------------------------------------------------------- */

/** Where the rate came from: the owner's own, or the last one this workspace froze for the pair. */
export interface PreviewRate {
  readonly value: number
  readonly source: string
}

/** What the owner is shown before confirming. Nothing in it is a name: people are participant ids. */
export interface CurrencyChangePreview {
  readonly from: string
  readonly to: string
  readonly rate: PreviewRate | null
  readonly counts: RebaseCounts
  readonly example: RebasePlan['example']
  readonly budgetTarget: RebasePlan['budgetTarget']
  readonly balances: {
    readonly maxMovementMinor: number
    readonly leftovers: ReadonlyArray<Leftover>
  } | null
  readonly statements: number
  readonly ceiling: number
  readonly refusal: RebaseRefusal | null
}

const NO_COUNTS: RebaseCounts = {
  expenses: 0,
  settlements: 0,
  budgetItems: 0,
  shareRows: 0,
  pinnedPrices: 0,
}

/** A preview that stopped before any money row was read. */
function declined(
  from: string,
  to: string,
  refusal: RebaseRefusal,
): CurrencyChangePreview {
  return {
    from,
    to,
    rate: null,
    counts: NO_COUNTS,
    example: null,
    budgetTarget: null,
    balances: null,
    statements: 0,
    ceiling: MAX_REBASE_STATEMENTS,
    refusal,
  }
}

type PricedTable = TenantTable & {
  readonly tripId: SQLiteColumn
  readonly priceMinor: SQLiteColumn
  readonly currency: SQLiteColumn
}

/** The priced rows of a reference table whose `NULL` currency means "the trip's own" (rule 7). */
async function countUnpinnedPrices(
  scope: TenantScope,
  table: PricedTable,
  tripId: string,
): Promise<number> {
  const [row] = await scope.db
    .select({ total: count() })
    .from(table)
    .where(
      tenantFilter(
        scope,
        table,
        eq(table.tripId, tripId),
        isNotNull(table.priceMinor),
        isNull(table.currency),
      ),
    )
  return row?.total ?? 0
}

/**
 * Reads the trip's money once: one query per table, each filtered by the workspace and the trip, so
 * the cost does not grow with the number of expenses (the `getExpenseWithShares` pattern would).
 *
 * Shares are ordered by `rowid`, which is the order they were inserted in and so the participant
 * order the split was written in: the order `computeShares` hands out remainder units in.
 */
async function readSnapshot(
  scope: TenantScope,
  tripId: string,
  budgetTargetMinor: number | null,
): Promise<RebaseSnapshot> {
  const [expenseRows, shareRows, paymentRows, itemRows, ...pinned] =
    await Promise.all([
      scope.db
        .select({
          id: expenses.id,
          amountMinor: expenses.amountMinor,
          currency: expenses.currency,
          originalAmountMinor: expenses.originalAmountMinor,
          originalCurrency: expenses.originalCurrency,
          exchangeRate: expenses.exchangeRate,
          splitMethod: expenses.splitMethod,
          paidBy: expenses.paidBy,
        })
        .from(expenses)
        .where(tenantFilter(scope, expenses, eq(expenses.tripId, tripId)))
        .orderBy(asc(expenses.id)),
      scope.db
        .select({
          id: expenseShares.id,
          expenseId: expenseShares.expenseId,
          userId: expenseShares.userId,
          shareMinor: expenseShares.shareMinor,
          weight: expenseShares.weight,
        })
        .from(expenseShares)
        .where(
          tenantFilter(scope, expenseShares, eq(expenseShares.tripId, tripId)),
        )
        .orderBy(asc(expenseShares.expenseId), sql`${expenseShares}.rowid`),
      scope.db
        .select({
          id: settlements.id,
          fromUserId: settlements.fromUserId,
          toUserId: settlements.toUserId,
          amountMinor: settlements.amountMinor,
          currency: settlements.currency,
          originalAmountMinor: settlements.originalAmountMinor,
          originalCurrency: settlements.originalCurrency,
          exchangeRate: settlements.exchangeRate,
        })
        .from(settlements)
        .where(tenantFilter(scope, settlements, eq(settlements.tripId, tripId)))
        .orderBy(asc(settlements.id)),
      scope.db
        .select({
          id: budgetItems.id,
          plannedAmountMinor: budgetItems.plannedAmountMinor,
          currency: budgetItems.currency,
          originalAmountMinor: budgetItems.originalAmountMinor,
          originalCurrency: budgetItems.originalCurrency,
          exchangeRate: budgetItems.exchangeRate,
        })
        .from(budgetItems)
        .where(tenantFilter(scope, budgetItems, eq(budgetItems.tripId, tripId)))
        .orderBy(asc(budgetItems.id)),
      countUnpinnedPrices(scope, places, tripId),
      countUnpinnedPrices(scope, reservations, tripId),
      countUnpinnedPrices(scope, transports, tripId),
      countUnpinnedPrices(scope, dayAccommodations, tripId),
    ])
  return {
    expenses: expenseRows,
    shares: shareRows,
    payments: paymentRows,
    plannedItems: itemRows,
    budgetTargetMinor,
    pinnedPrices: pinned.reduce((total, rows) => total + rows, 0),
  }
}

/** The day a rate is wanted for: today. Only a provider port reads it; a frozen rate is the latest. */
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * What re-basing the trip's budget currency to `to` would do, or why it cannot. Reads only.
 *
 * The caller must be the owner of a trip that is not archived: the trip is resolved in their scope
 * first (a trip of another workspace, or a private one they are not on, is `NotFoundError` and
 * nothing is read), an archived trip is refused, and only then is the role checked, so an editor
 * or a viewer learns nothing they could not see. All of that happens before a single money row is
 * read.
 *
 * With no `rate` the one rate is the last this workspace froze for the pair, from trips the caller
 * can read; with one, that is the rate. Neither is ever invented: no answer is the `no-rate`
 * refusal.
 */
export async function previewCurrencyChange(
  scope: TenantScope,
  tripId: string,
  input: PreviewCurrencyChangeInput,
): Promise<CurrencyChangePreview> {
  const { to, rate: typed } = previewCurrencyChangeInput.parse(input)
  const id = idSchema.parse(tripId)

  const trip = await requireWritableTrip(scope, id)
  await assertTripRole(scope, id, ['owner'])

  const from = trip.currency
  if (to === from) {
    return declined(from, to, { kind: 'same-currency' })
  }
  if (trip.copyPendingAt !== null) {
    return declined(from, to, { kind: 'copy-pending' })
  }

  const snapshot = await readSnapshot(scope, id, trip.budgetTargetMinor)

  const resolved = needsRate(snapshot)
    ? await resolveRate(scope, { from, to, on: today(), manual: typed })
    : null
  const usable =
    resolved !== null && rebaseRateSchema.safeParse(resolved.rate).success
      ? { value: resolved.rate, source: resolved.source }
      : null

  const outcome = planRebase(snapshot, {
    from,
    to,
    rate: usable?.value ?? null,
  })
  if (outcome.kind === 'refused') {
    return {
      from,
      to,
      rate: usable,
      counts: countRebase(snapshot),
      example: null,
      budgetTarget: null,
      balances: null,
      statements: countRebaseStatements(snapshot),
      ceiling: MAX_REBASE_STATEMENTS,
      refusal: outcome.refusal,
    }
  }
  const { plan } = outcome
  return {
    from,
    to,
    rate: usable,
    counts: plan.counts,
    example: plan.example,
    budgetTarget: plan.budgetTarget,
    balances: {
      maxMovementMinor: plan.balances.maxMovementMinor,
      leftovers: plan.balances.leftovers,
    },
    statements: plan.statements,
    ceiling: MAX_REBASE_STATEMENTS,
    refusal: null,
  }
}
