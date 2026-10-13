/**
 * Everything the costs screen computes, with no React in sight.
 *
 * Filtering, day grouping, the optimistic overlay and the CSV export are all pure
 * functions of the server payload, which is what makes the split maths and the
 * money arithmetic testable without mounting a component.
 *
 * The rule the overlay obeys: with nothing in flight, every aggregate is the one
 * the repository computed — the payload is returned untouched. Only while a write
 * is pending does this module apply a delta, and it applies exactly the delta the
 * repository will apply when it answers, so the numbers never jump when the real
 * answer lands.
 */
import { formatDayMonth, formatWeekday } from '#/lib/format'
import { DEFAULT_LOCALE } from '#/lib/i18n/locales'
import { currencyCode, formatMoneyPlain, suggestTransfers } from '#/lib/money'

import type { Locale } from '#/lib/i18n/locales'

import type {
  CostsBalance,
  CostsCategoryTotal,
  CostsExpense,
  CostsPayload,
  CostsPerson,
  CostsSettlement,
  CostsSuggestion,
  ExpenseCategory,
} from '#/server/fns/costs'

/* -------------------------------------------------------------------------- */
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A `spent_on` column is a calendar date, not an instant, so it is read in UTC:
 * reading it in the browser's zone would move half the expenses in a Tokyo trip
 * to the previous day for a reader in London. `src/lib/format.ts` parses an ISO
 * day the same way, which is why the two helpers below can hand off to it.
 */

/** `2026-06-23` → a UTC `Date`, or `null` when the column is unusable. */
export function parseDay(value: string | null | undefined): Date | null {
  if (typeof value !== 'string' || value.length < 10) {
    return null
  }
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** A `Date` back to the `YYYY-MM-DD` shape the column holds. */
export function toDayString(value: Date): string {
  return value.toISOString().slice(0, 10)
}

/** `2026-06-23` → `Tue 23 Jun`, in the reader's own locale. Falls back to the raw column. */
export function formatDayLabel(
  value: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return formatWeekday(value, locale) ?? value
}

/** `2026-06-23` → `23 Jun`, for a filter option that must stay narrow. */
export function formatDayShort(
  value: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return formatDayMonth(value, locale) ?? value
}

/* -------------------------------------------------------------------------- */
/* Filters                                                                    */
/* -------------------------------------------------------------------------- */

export const EXPENSE_VIEWS = ['all', 'paid', 'owed'] as const

export type ExpenseView = (typeof EXPENSE_VIEWS)[number]

export function isExpenseView(value: string): value is ExpenseView {
  return (EXPENSE_VIEWS as ReadonlyArray<string>).includes(value)
}

/** The filter state, which lives in the URL so a filtered view is shareable. */
export interface CostsFilters {
  /** Free text over title, notes and the payer's name. */
  readonly q: string | undefined
  readonly category: ExpenseCategory | undefined
  /** A `YYYY-MM-DD` day. */
  readonly day: string | undefined
  readonly view: ExpenseView
}

/** True when anything is narrowing the list — drives the "clear filters" affordance. */
export function isFiltered(filters: CostsFilters): boolean {
  return (
    filters.view !== 'all' ||
    filters.category !== undefined ||
    filters.day !== undefined ||
    (filters.q ?? '').trim() !== ''
  )
}

/** What one traveller is on the hook for on a given expense. */
export function shareOf(row: CostsExpense, userId: string): number {
  return row.shares.find((share) => share.userId === userId)?.shareMinor ?? 0
}

/**
 * The rows the reader asked to see.
 *
 * `paid` and `owed` are deliberately not complements: an expense the viewer paid
 * *and* took a share of belongs in both, because both statements are true of it.
 */
export function filterExpenses(
  rows: ReadonlyArray<CostsExpense>,
  filters: CostsFilters,
  people: ReadonlyArray<CostsPerson>,
  viewerUserId: string,
): Array<CostsExpense> {
  const needle = (filters.q ?? '').trim().toLowerCase()
  const nameOf = new Map(
    people.map((person) => [person.userId, person.name.toLowerCase()]),
  )

  return rows.filter((row) => {
    if (filters.category !== undefined && row.category !== filters.category) {
      return false
    }
    if (filters.day !== undefined && row.spentOn !== filters.day) {
      return false
    }
    if (filters.view === 'paid' && row.paidBy !== viewerUserId) {
      return false
    }
    if (filters.view === 'owed') {
      const owedToViewer = row.paidBy === viewerUserId
      const others = row.shares.some((share) => share.userId !== viewerUserId)
      if (!owedToViewer || !others) {
        return false
      }
    }
    if (needle === '') {
      return true
    }
    const payer = row.paidBy === null ? '' : (nameOf.get(row.paidBy) ?? '')
    const haystack =
      `${row.title} ${row.notes ?? ''} ${row.category} ${payer}`.toLowerCase()
    return haystack.includes(needle)
  })
}

/* -------------------------------------------------------------------------- */
/* Grouping                                                                   */
/* -------------------------------------------------------------------------- */

export interface DayGroup {
  readonly day: string
  readonly label: string
  readonly totalMinor: number
  readonly rows: ReadonlyArray<CostsExpense>
}

/** Newest day first, matching the order the repository lists expenses in. */
export function groupByDay(
  rows: ReadonlyArray<CostsExpense>,
  locale: Locale = DEFAULT_LOCALE,
): Array<DayGroup> {
  const buckets = new Map<string, Array<CostsExpense>>()
  for (const row of rows) {
    const bucket = buckets.get(row.spentOn)
    if (bucket === undefined) {
      buckets.set(row.spentOn, [row])
    } else {
      bucket.push(row)
    }
  }
  return [...buckets.entries()]
    .sort((left, right) => right[0].localeCompare(left[0]))
    .map(([day, group]) => ({
      day,
      label: formatDayLabel(day, locale),
      rows: group,
      totalMinor: group.reduce((total, row) => total + row.amountMinor, 0),
    }))
}

/** The distinct days that have an expense on them, newest first. */
export function dayOptions(rows: ReadonlyArray<CostsExpense>): Array<string> {
  return [...new Set(rows.map((row) => row.spentOn))].sort((left, right) =>
    right.localeCompare(left),
  )
}

/**
 * Daily totals, oldest first — the series behind the spend curve.
 *
 * Days with no spend are not filled in: the curve reports what was spent, and
 * inventing zeroes for the gaps would draw a shape the trip never had.
 */
export function dailySeries(rows: ReadonlyArray<CostsExpense>): Array<number> {
  const totals = new Map<string, number>()
  for (const row of rows) {
    totals.set(row.spentOn, (totals.get(row.spentOn) ?? 0) + row.amountMinor)
  }
  return [...totals.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([, total]) => total)
}

/* -------------------------------------------------------------------------- */
/* Optimistic overlay                                                         */
/* -------------------------------------------------------------------------- */

export type CostsOp =
  | {
      readonly kind: 'create'
      readonly key: string
      readonly row: CostsExpense
    }
  | {
      readonly kind: 'update'
      readonly key: string
      readonly previous: CostsExpense
      readonly row: CostsExpense
    }
  | {
      readonly kind: 'delete'
      readonly key: string
      readonly previous: CostsExpense
    }
  | {
      readonly kind: 'payment'
      readonly key: string
      readonly row: CostsSettlement
    }

/** The screen's data after any in-flight writes are folded in. */
export interface CostsSnapshot {
  readonly expenses: ReadonlyArray<CostsExpense>
  readonly settlements: ReadonlyArray<CostsSettlement>
  readonly balances: ReadonlyArray<CostsBalance>
  readonly byCategory: ReadonlyArray<CostsCategoryTotal>
  readonly suggestions: ReadonlyArray<CostsSuggestion>
  readonly spentMinor: number
  readonly expenseCount: number
  /** Expense ids whose row is mid-write, so it can be drawn as busy. */
  readonly busyExpenseIds: ReadonlySet<string>
  /** True while any write is in flight. */
  readonly busy: boolean
}

/** A traveller's ledger movement from one expense: they paid it, they owe a share. */
function ledgerOf(row: CostsExpense): Map<string, number> {
  const delta = new Map<string, number>()
  if (row.paidBy !== null) {
    delta.set(row.paidBy, (delta.get(row.paidBy) ?? 0) + row.amountMinor)
  }
  for (const share of row.shares) {
    delta.set(share.userId, (delta.get(share.userId) ?? 0) - share.shareMinor)
  }
  return delta
}

function mergeInto(
  target: Map<string, number>,
  source: Map<string, number>,
  sign: 1 | -1,
): void {
  for (const [userId, value] of source) {
    target.set(userId, (target.get(userId) ?? 0) + sign * value)
  }
}

/**
 * The payload with in-flight writes folded in.
 *
 * With an empty queue this returns the repository's own aggregates verbatim, by
 * reference — the fast path, and the honest one: nothing on the screen is a guess
 * unless something really is pending.
 */
export function applyOps(
  payload: CostsPayload,
  ops: ReadonlyArray<CostsOp>,
): CostsSnapshot {
  if (ops.length === 0) {
    return {
      expenses: payload.expenses,
      settlements: payload.settlements,
      balances: payload.balances,
      byCategory: payload.byCategory,
      suggestions: payload.suggestions,
      spentMinor: payload.spentMinor,
      expenseCount: payload.expenseCount,
      busyExpenseIds: new Set<string>(),
      busy: false,
    }
  }

  const rows = new Map(payload.expenses.map((row) => [row.id, row]))
  const created: Array<CostsExpense> = []
  const settlements = [...payload.settlements]
  const busyExpenseIds = new Set<string>()
  const balanceDelta = new Map<string, number>()
  const categoryDelta = new Map<string, number>()
  const countDelta = new Map<string, number>()
  let spentDelta = 0
  let expenseCountDelta = 0

  const addCategory = (
    category: string,
    amount: number,
    count: number,
  ): void => {
    categoryDelta.set(category, (categoryDelta.get(category) ?? 0) + amount)
    countDelta.set(category, (countDelta.get(category) ?? 0) + count)
  }

  for (const op of ops) {
    if (op.kind === 'create') {
      created.push(op.row)
      busyExpenseIds.add(op.row.id)
      mergeInto(balanceDelta, ledgerOf(op.row), 1)
      addCategory(op.row.category, op.row.amountMinor, 1)
      spentDelta += op.row.amountMinor
      expenseCountDelta += 1
      continue
    }
    if (op.kind === 'update') {
      rows.set(op.row.id, op.row)
      busyExpenseIds.add(op.row.id)
      mergeInto(balanceDelta, ledgerOf(op.previous), -1)
      mergeInto(balanceDelta, ledgerOf(op.row), 1)
      addCategory(op.previous.category, -op.previous.amountMinor, -1)
      addCategory(op.row.category, op.row.amountMinor, 1)
      spentDelta += op.row.amountMinor - op.previous.amountMinor
      continue
    }
    if (op.kind === 'delete') {
      rows.delete(op.previous.id)
      busyExpenseIds.add(op.previous.id)
      mergeInto(balanceDelta, ledgerOf(op.previous), -1)
      addCategory(op.previous.category, -op.previous.amountMinor, -1)
      spentDelta -= op.previous.amountMinor
      expenseCountDelta -= 1
      continue
    }
    settlements.unshift(op.row)
    balanceDelta.set(
      op.row.fromUserId,
      (balanceDelta.get(op.row.fromUserId) ?? 0) + op.row.amountMinor,
    )
    balanceDelta.set(
      op.row.toUserId,
      (balanceDelta.get(op.row.toUserId) ?? 0) - op.row.amountMinor,
    )
  }

  // Newly created rows have no server id to sort against, so they lead their day.
  const expenses = [...created, ...rows.values()].sort((left, right) =>
    right.spentOn.localeCompare(left.spentOn),
  )

  const balances = mergeBalances(payload.balances, balanceDelta)

  return {
    expenses,
    settlements,
    balances,
    byCategory: payload.byCategory.map((row) => ({
      category: row.category,
      plannedMinor: row.plannedMinor,
      spentMinor: Math.max(
        row.spentMinor + (categoryDelta.get(row.category) ?? 0),
        0,
      ),
      expenseCount: Math.max(
        row.expenseCount + (countDelta.get(row.category) ?? 0),
        0,
      ),
    })),
    suggestions: suggestTransfers(balances),
    spentMinor: Math.max(payload.spentMinor + spentDelta, 0),
    expenseCount: Math.max(payload.expenseCount + expenseCountDelta, 0),
    busyExpenseIds,
    busy: true,
  }
}

/**
 * Balances plus a delta, with a row invented for anyone the delta names who had no
 * ledger yet — the first expense a new traveller is included in has to be able to
 * put them on the board.
 */
function mergeBalances(
  balances: ReadonlyArray<CostsBalance>,
  delta: ReadonlyMap<string, number>,
): Array<CostsBalance> {
  const known = new Set(balances.map((row) => row.userId))
  const merged: Array<CostsBalance> = balances.map((row) => ({
    ...row,
    balanceMinor: row.balanceMinor + (delta.get(row.userId) ?? 0),
  }))
  for (const [userId, value] of delta) {
    if (!known.has(userId)) {
      merged.push({
        userId,
        paidMinor: 0,
        shareMinor: 0,
        settledOutMinor: 0,
        settledInMinor: 0,
        balanceMinor: value,
      })
    }
  }
  return merged.sort((left, right) => right.balanceMinor - left.balanceMinor)
}

/* -------------------------------------------------------------------------- */
/* Derived headline figures                                                   */
/* -------------------------------------------------------------------------- */

export interface CostsTotals {
  /** What the viewer owes, as a positive figure. */
  readonly owesMinor: number
  /** What the viewer is owed, as a positive figure. */
  readonly owedMinor: number
  /** Expenses nobody has claimed as payer yet. */
  readonly unclaimedMinor: number
  readonly unclaimedCount: number
  /** The viewer's own responsibility across every split. */
  readonly viewerShareMinor: number
  /** What the viewer put on their own card. */
  readonly viewerPaidMinor: number
}

export function totalsFor(
  snapshot: CostsSnapshot,
  viewerUserId: string,
): CostsTotals {
  const self = snapshot.balances.find((row) => row.userId === viewerUserId)
  const unclaimed = snapshot.expenses.filter((row) => row.paidBy === null)

  return {
    owesMinor: self === undefined ? 0 : Math.max(-self.balanceMinor, 0),
    owedMinor: self === undefined ? 0 : Math.max(self.balanceMinor, 0),
    unclaimedMinor: unclaimed.reduce(
      (total, row) => total + row.amountMinor,
      0,
    ),
    unclaimedCount: unclaimed.length,
    viewerShareMinor: snapshot.expenses.reduce(
      (total, row) => total + shareOf(row, viewerUserId),
      0,
    ),
    viewerPaidMinor: snapshot.expenses.reduce(
      (total, row) =>
        row.paidBy === viewerUserId ? total + row.amountMinor : total,
      0,
    ),
  }
}

/** One traveller's responsibility across every split, in integer minor units. */
export interface MemberShareTotal {
  readonly userId: string
  readonly shareMinor: number
}

/**
 * What each traveller's shares add up to over the expense rows, ascending by user id.
 *
 * The rows are the source, not `balances[].shareMinor`: while a write is in flight the
 * overlay folds it into `balanceMinor` only, so the expense rows are the one place the
 * new expense's shares are already counted. With nothing in flight the two agree. The
 * user id is the one key no write changes, so it is the deterministic order.
 */
export function memberShares(
  expenses: ReadonlyArray<CostsExpense>,
): Array<MemberShareTotal> {
  const totals = new Map<string, number>()
  for (const row of expenses) {
    for (const share of row.shares) {
      totals.set(
        share.userId,
        (totals.get(share.userId) ?? 0) + share.shareMinor,
      )
    }
  }
  return [...totals]
    .map(([userId, shareMinor]) => ({ userId, shareMinor }))
    .sort((a, b) => (a.userId < b.userId ? -1 : 1))
}

/* -------------------------------------------------------------------------- */
/* CSV export                                                                 */
/* -------------------------------------------------------------------------- */

/** Excel on Windows needs the byte-order mark to read the file as UTF-8. */
const BOM = '\ufeff'

const CSV_HEADERS = [
  'Date',
  'Title',
  'Category',
  'Amount',
  'Currency',
  'Original amount',
  'Original currency',
  'Rate',
  'Paid by',
  'Split method',
  'Your share',
  'Notes',
] as const

/**
 * One CSV field, quoted per RFC 4180.
 *
 * The leading-glyph guard is not cosmetic: a spreadsheet treats a field starting
 * `=`, `+` or `@` as a formula, and expense titles are traveller-supplied text.
 * Prefixing a single quote is what every export that survived a security review
 * does — the cell still reads correctly, and it is inert.
 */
function csvField(value: string): string {
  const guarded = /^[=+@\t\r]/.test(value) ? `'${value}` : value
  return `"${guarded.replace(/"/g, '""')}"`
}

function csvLine(fields: ReadonlyArray<string>): string {
  return fields.map(csvField).join(',')
}

/**
 * The loaded rows as a CSV document, generated in the browser.
 *
 * Amounts are written unformatted in major units so a spreadsheet reads them as
 * numbers, and the currency travels in its own column. A BOM leads the file
 * because Excel on Windows otherwise renders `¥` and `£` as mojibake.
 */
export function expensesCsv(input: {
  readonly rows: ReadonlyArray<CostsExpense>
  readonly people: ReadonlyArray<CostsPerson>
  readonly viewerUserId: string
}): string {
  const nameOf = new Map(
    input.people.map((person) => [person.userId, person.name]),
  )

  const lines = [csvLine(CSV_HEADERS)]
  for (const row of input.rows) {
    lines.push(
      csvLine([
        row.spentOn,
        row.title,
        row.category,
        formatMoneyPlain(row.amountMinor, row.currency),
        currencyCode(row.currency),
        row.originalAmountMinor === null
          ? ''
          : formatMoneyPlain(row.originalAmountMinor, row.originalCurrency),
        row.originalCurrency === null ? '' : currencyCode(row.originalCurrency),
        row.exchangeRate === null ? '' : row.exchangeRate.toFixed(4),
        row.paidBy === null
          ? ''
          : (nameOf.get(row.paidBy) ?? 'Removed traveller'),
        row.splitMethod,
        formatMoneyPlain(shareOf(row, input.viewerUserId), row.currency),
        row.notes ?? '',
      ]),
    )
  }
  return `${BOM}${lines.join('\r\n')}\r\n`
}

/** `Tokyo & Kyoto` → `tokyo-kyoto-expenses-2026-08-19.csv`. */
export function csvFilename(title: string, today: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug === '' ? 'trip' : slug}-expenses-${today}.csv`
}

/**
 * Hands the reader a file without a server round trip or a new dependency.
 *
 * The object URL is revoked on the next frame rather than immediately: Safari
 * cancels an in-flight download when the URL it came from is revoked in the same
 * task.
 */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  // `appendChild` rather than `append`: the Workers types merge their own
  // `Element.append(content)` into the global interface, and the DOM overload
  // stops resolving. Firefox also wants the anchor in the document to click it.
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  requestAnimationFrame(() => URL.revokeObjectURL(url))
}

/* -------------------------------------------------------------------------- */
/* Misc                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A client-side id for a row that does not exist on the server yet.
 *
 * Prefixed rather than random-only so a stray optimistic id can never be mistaken
 * for a real one, and so `busyExpenseIds` reads plainly in a devtools inspection.
 */
export function optimisticId(): string {
  return `pending-${Math.random().toString(36).slice(2, 10)}`
}

/** True for an id this module minted, i.e. a row that has no server row yet. */
export function isOptimisticId(id: string): boolean {
  return id.startsWith('pending-')
}
