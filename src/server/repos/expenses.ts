/**
 * Money: the planned budget, what was actually spent, how each expense splits between travellers,
 * and the settlements that clear the resulting debts.
 *
 * Every amount is an integer in the minor unit of its currency (`docs/SPEC.md` §6) — there is no
 * floating point arithmetic in this module. Splits are computed here rather than in the client so
 * that the rounding remainder is distributed once, deterministically, and always sums back to the
 * expense total.
 */

import { and, asc, count, desc, eq, sum } from 'drizzle-orm'
import { z } from 'zod'
import {
  EXPENSE_CATEGORIES,
  SETTLEMENT_METHODS,
  SPLIT_METHODS,
  budgetItems,
  expenseShares,
  expenses,
  settlements,
} from '#/server/db/schema'
import { createTenantRepository, tenantFilter } from './base'
import { RepositoryError } from './context'
import { requireTripDay } from './days'
import { placesRepository } from './places'
import { requireTrip } from './trips'
import {
  currencySchema,
  dateSchema,
  definedOnly,
  idSchema,
  longTextSchema,
  minorAmountSchema,
  nonNegativeIntSchema,
  shortTextSchema,
  sortOrderSchema,
  titleSchema,
} from './validation'
import type { BudgetItem, Expense, ExpenseShare, Settlement } from '#/server/db/types'
import type { TenantScope } from './base'

export const budgetItemsRepository = createTenantRepository(budgetItems, 'budget item')
export const expensesRepository = createTenantRepository(expenses, 'expense')
export const expenseSharesRepository = createTenantRepository(expenseShares, 'expense share')
export const settlementsRepository = createTenantRepository(settlements, 'settlement')

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

const categorySchema = z.enum(EXPENSE_CATEGORIES)
const splitMethodSchema = z.enum(SPLIT_METHODS)

export const splitParticipantInput = z.object({
  userId: idSchema,
  /** Relative weight for `shares`, ignored by the other methods. */
  weight: z.number().finite().min(0).max(1000).optional(),
  /** Exact amount for `exact`, in the expense's minor unit. */
  shareMinor: minorAmountSchema.optional(),
  /** Whole or fractional percent for `percentage`; the set must add up to 100. */
  percentage: z.number().finite().min(0).max(100).optional(),
})
export type SplitParticipantInput = z.infer<typeof splitParticipantInput>

export const createBudgetItemInput = z.object({
  tripId: idSchema,
  category: categorySchema.optional(),
  name: titleSchema,
  plannedAmountMinor: minorAmountSchema.optional(),
  currency: currencySchema.optional(),
  persons: nonNegativeIntSchema.max(1000).nullish(),
  days: nonNegativeIntSchema.max(1000).nullish(),
  note: shortTextSchema.nullish(),
  sortOrder: sortOrderSchema.optional(),
})
export type CreateBudgetItemInput = z.infer<typeof createBudgetItemInput>

export const updateBudgetItemInput = z.object({
  category: categorySchema.optional(),
  name: titleSchema.optional(),
  plannedAmountMinor: minorAmountSchema.optional(),
  currency: currencySchema.optional(),
  persons: nonNegativeIntSchema.max(1000).nullish(),
  days: nonNegativeIntSchema.max(1000).nullish(),
  note: shortTextSchema.nullish(),
  sortOrder: sortOrderSchema.optional(),
})
export type UpdateBudgetItemInput = z.infer<typeof updateBudgetItemInput>

const expenseFields = {
  dayId: idSchema.nullish(),
  placeId: idSchema.nullish(),
  budgetItemId: idSchema.nullish(),
  category: categorySchema.optional(),
  title: titleSchema,
  amountMinor: minorAmountSchema,
  currency: currencySchema.optional(),
  originalAmountMinor: minorAmountSchema.nullish(),
  originalCurrency: currencySchema.nullish(),
  exchangeRate: z.number().finite().positive().nullish(),
  spentOn: dateSchema,
  paidBy: idSchema.nullish(),
  splitMethod: splitMethodSchema.optional(),
  notes: longTextSchema.nullish(),
}

export const createExpenseInput = z.object({
  tripId: idSchema,
  ...expenseFields,
  /** Who shares this expense. Omit for an expense that is not split. */
  participants: z.array(splitParticipantInput).max(100).optional(),
})
export type CreateExpenseInput = z.infer<typeof createExpenseInput>

export const updateExpenseInput = z.object({
  ...expenseFields,
  title: titleSchema.optional(),
  amountMinor: minorAmountSchema.optional(),
  spentOn: dateSchema.optional(),
  participants: z.array(splitParticipantInput).max(100).optional(),
})
export type UpdateExpenseInput = z.infer<typeof updateExpenseInput>

export const createSettlementInput = z.object({
  tripId: idSchema,
  fromUserId: idSchema,
  toUserId: idSchema,
  amountMinor: minorAmountSchema,
  currency: currencySchema.optional(),
  method: z.enum(SETTLEMENT_METHODS).optional(),
  settledOn: dateSchema,
  note: shortTextSchema.nullish(),
})
export type CreateSettlementInput = z.infer<typeof createSettlementInput>

/* -------------------------------------------------------------------------------------------------
 * Split arithmetic
 * ---------------------------------------------------------------------------------------------- */

export interface ComputedShare {
  readonly userId: string
  readonly shareMinor: number
  readonly weight: number
}

/**
 * Splits `amountMinor` across `participants` by `method`. The result always sums exactly to
 * `amountMinor`: the rounding remainder is handed out one minor unit at a time, in participant order,
 * so the same input always produces the same split.
 */
export function computeShares(
  amountMinor: number,
  method: (typeof SPLIT_METHODS)[number],
  participants: ReadonlyArray<SplitParticipantInput>,
): Array<ComputedShare> {
  if (participants.length === 0) {
    return []
  }

  if (method === 'exact') {
    const total = participants.reduce((sumSoFar, part) => sumSoFar + (part.shareMinor ?? 0), 0)
    if (total !== amountMinor) {
      throw new RepositoryError(
        `Exact shares must add up to the expense total (${total} vs ${amountMinor}).`,
        'SPLIT_MISMATCH',
      )
    }
    return participants.map((part) => ({
      userId: part.userId,
      shareMinor: part.shareMinor ?? 0,
      weight: 1,
    }))
  }

  const weights = participants.map((part) => {
    if (method === 'equal') {
      return 1
    }
    if (method === 'percentage') {
      return part.percentage ?? 0
    }
    return part.weight ?? 1
  })

  const weightTotal = weights.reduce((sumSoFar, weight) => sumSoFar + weight, 0)
  if (weightTotal <= 0) {
    throw new RepositoryError('A split needs at least one positive weight.', 'SPLIT_MISMATCH')
  }
  if (method === 'percentage' && Math.abs(weightTotal - 100) > 0.001) {
    throw new RepositoryError('Percentage shares must add up to 100.', 'SPLIT_MISMATCH')
  }

  const raw = weights.map((weight) => Math.floor((amountMinor * weight) / weightTotal))
  let remainder = amountMinor - raw.reduce((sumSoFar, value) => sumSoFar + value, 0)

  return participants.map((part, index) => {
    const extra = remainder > 0 ? 1 : 0
    remainder -= extra
    return {
      userId: part.userId,
      shareMinor: (raw[index] ?? 0) + extra,
      weight: weights[index] ?? 1,
    }
  })
}

/* -------------------------------------------------------------------------------------------------
 * Budget items
 * ---------------------------------------------------------------------------------------------- */

export async function listBudgetItems(
  scope: TenantScope,
  tripId: string,
): Promise<Array<BudgetItem>> {
  return budgetItemsRepository.findMany(scope, {
    where: eq(budgetItems.tripId, tripId),
    orderBy: [asc(budgetItems.sortOrder), asc(budgetItems.id)],
  })
}

export async function createBudgetItem(
  scope: TenantScope,
  input: CreateBudgetItemInput,
): Promise<BudgetItem> {
  const values = createBudgetItemInput.parse(input)
  await requireTrip(scope, values.tripId)
  return budgetItemsRepository.insert(scope, values)
}

export async function updateBudgetItem(
  scope: TenantScope,
  budgetItemId: string,
  input: UpdateBudgetItemInput,
): Promise<BudgetItem> {
  return budgetItemsRepository.requireUpdate(
    scope,
    budgetItemId,
    definedOnly(updateBudgetItemInput.parse(input)),
  )
}

export async function deleteBudgetItem(scope: TenantScope, budgetItemId: string): Promise<void> {
  await budgetItemsRepository.requireRemove(scope, budgetItemId)
}

/* -------------------------------------------------------------------------------------------------
 * Expenses
 * ---------------------------------------------------------------------------------------------- */

export async function listTripExpenses(
  scope: TenantScope,
  tripId: string,
  options: { readonly category?: (typeof EXPENSE_CATEGORIES)[number]; readonly limit?: number } = {},
): Promise<Array<Expense>> {
  return expensesRepository.findMany(scope, {
    where: and(
      eq(expenses.tripId, tripId),
      options.category ? eq(expenses.category, options.category) : undefined,
    ),
    orderBy: [desc(expenses.spentOn), desc(expenses.id)],
    limit: options.limit,
  })
}

export async function getExpense(scope: TenantScope, expenseId: string): Promise<Expense | null> {
  return expensesRepository.findById(scope, expenseId)
}

export interface ExpenseWithShares {
  readonly expense: Expense
  readonly shares: ReadonlyArray<ExpenseShare>
}

/** One expense with its split rows — the expense detail sheet. */
export async function getExpenseWithShares(
  scope: TenantScope,
  expenseId: string,
): Promise<ExpenseWithShares> {
  const expense = await expensesRepository.requireById(scope, expenseId)
  const shares = await expenseSharesRepository.findMany(scope, {
    where: eq(expenseShares.expenseId, expenseId),
    orderBy: [asc(expenseShares.id)],
  })
  return { expense, shares }
}

/** Creates an expense and, when participants are supplied, its split rows. */
export async function createExpense(
  scope: TenantScope,
  input: CreateExpenseInput,
): Promise<ExpenseWithShares> {
  const { participants, ...values } = createExpenseInput.parse(input)
  await requireTrip(scope, values.tripId)
  if (values.dayId) {
    await requireTripDay(scope, values.tripId, values.dayId)
  }
  if (values.placeId) {
    await placesRepository.requireById(scope, values.placeId)
  }
  if (values.budgetItemId) {
    await budgetItemsRepository.requireById(scope, values.budgetItemId)
  }

  const expense = await expensesRepository.insert(scope, {
    ...values,
    createdBy: scope.ctx.userId,
  })

  const shares = await writeShares(
    scope,
    expense,
    participants ?? [],
    values.splitMethod ?? 'equal',
  )
  return { expense, shares }
}

export async function updateExpense(
  scope: TenantScope,
  expenseId: string,
  input: UpdateExpenseInput,
): Promise<ExpenseWithShares> {
  const { participants, ...patch } = updateExpenseInput.parse(input)
  const existing = await expensesRepository.requireById(scope, expenseId)
  if (patch.dayId) {
    await requireTripDay(scope, existing.tripId, patch.dayId)
  }
  const expense = await expensesRepository.requireUpdate(scope, expenseId, definedOnly(patch))

  if (participants === undefined) {
    const shares = await expenseSharesRepository.findMany(scope, {
      where: eq(expenseShares.expenseId, expenseId),
    })
    return { expense, shares }
  }

  const shares = await writeShares(
    scope,
    expense,
    participants,
    patch.splitMethod ?? expense.splitMethod,
  )
  return { expense, shares }
}

/** Replaces an expense's split rows. Passing an empty participant list removes the split. */
export async function setExpenseShares(
  scope: TenantScope,
  expenseId: string,
  participants: ReadonlyArray<SplitParticipantInput>,
  method?: (typeof SPLIT_METHODS)[number],
): Promise<Array<ExpenseShare>> {
  const expense = await expensesRepository.requireById(scope, expenseId)
  const parsed = z.array(splitParticipantInput).max(100).parse([...participants])
  return writeShares(scope, expense, parsed, method ?? expense.splitMethod)
}

async function writeShares(
  scope: TenantScope,
  expense: Expense,
  participants: ReadonlyArray<SplitParticipantInput>,
  method: string,
): Promise<Array<ExpenseShare>> {
  await expenseSharesRepository.removeWhere(scope, eq(expenseShares.expenseId, expense.id))
  if (participants.length === 0) {
    return []
  }
  const computed = computeShares(
    expense.amountMinor,
    z.enum(SPLIT_METHODS).parse(method),
    participants,
  )
  const rows = await expenseSharesRepository.insertMany(
    scope,
    computed.map((share) => ({
      tripId: expense.tripId,
      expenseId: expense.id,
      userId: share.userId,
      shareMinor: share.shareMinor,
      weight: share.weight,
    })),
  )

  // `RETURNING` has no defined row order, so the rows are handed back in participant order.
  const position = new Map(computed.map((share, index) => [share.userId, index]))
  return [...rows].sort(
    (left, right) => (position.get(left.userId) ?? 0) - (position.get(right.userId) ?? 0),
  )
}

export async function markShareSettled(
  scope: TenantScope,
  shareId: string,
  isSettled: boolean,
): Promise<ExpenseShare> {
  return expenseSharesRepository.requireUpdate(scope, shareId, { isSettled })
}

export async function deleteExpense(scope: TenantScope, expenseId: string): Promise<void> {
  await expensesRepository.requireRemove(scope, expenseId)
}

/* -------------------------------------------------------------------------------------------------
 * Settlements
 * ---------------------------------------------------------------------------------------------- */

export async function listSettlements(
  scope: TenantScope,
  tripId: string,
): Promise<Array<Settlement>> {
  return settlementsRepository.findMany(scope, {
    where: eq(settlements.tripId, tripId),
    orderBy: [desc(settlements.settledOn), desc(settlements.id)],
  })
}

export async function createSettlement(
  scope: TenantScope,
  input: CreateSettlementInput,
): Promise<Settlement> {
  const values = createSettlementInput.parse(input)
  if (values.fromUserId === values.toUserId) {
    throw new RepositoryError('A settlement needs two different people.', 'INVALID_SETTLEMENT')
  }
  await requireTrip(scope, values.tripId)
  return settlementsRepository.insert(scope, { ...values, createdBy: scope.ctx.userId })
}

export async function deleteSettlement(scope: TenantScope, settlementId: string): Promise<void> {
  await settlementsRepository.requireRemove(scope, settlementId)
}

/* -------------------------------------------------------------------------------------------------
 * Aggregates
 * ---------------------------------------------------------------------------------------------- */

export interface CategoryTotal {
  readonly category: (typeof EXPENSE_CATEGORIES)[number]
  readonly plannedMinor: number
  readonly spentMinor: number
  readonly expenseCount: number
}

export interface TripSpendSummary {
  readonly currency: string
  readonly plannedMinor: number
  readonly spentMinor: number
  readonly budgetTargetMinor: number | null
  readonly expenseCount: number
  readonly byCategory: ReadonlyArray<CategoryTotal>
}

/** Planned versus actual for a trip, overall and per category — the costs screen header. */
export async function getTripSpendSummary(
  scope: TenantScope,
  tripId: string,
): Promise<TripSpendSummary> {
  const trip = await requireTrip(scope, tripId)

  const [plannedRows, spentRows] = await Promise.all([
    scope.db
      .select({ category: budgetItems.category, planned: sum(budgetItems.plannedAmountMinor) })
      .from(budgetItems)
      .where(tenantFilter(scope, budgetItems, eq(budgetItems.tripId, tripId)))
      .groupBy(budgetItems.category),
    scope.db
      .select({
        category: expenses.category,
        spent: sum(expenses.amountMinor),
        expenseCount: count(),
      })
      .from(expenses)
      .where(tenantFilter(scope, expenses, eq(expenses.tripId, tripId)))
      .groupBy(expenses.category),
  ])

  const planned = new Map(plannedRows.map((row) => [row.category, Number(row.planned ?? 0)]))
  const spent = new Map(spentRows.map((row) => [row.category, Number(row.spent ?? 0)]))
  const counts = new Map(spentRows.map((row) => [row.category, row.expenseCount]))

  const byCategory = EXPENSE_CATEGORIES.map((category) => ({
    category,
    plannedMinor: planned.get(category) ?? 0,
    spentMinor: spent.get(category) ?? 0,
    expenseCount: counts.get(category) ?? 0,
  }))

  return {
    currency: trip.currency,
    plannedMinor: byCategory.reduce((total, row) => total + row.plannedMinor, 0),
    spentMinor: byCategory.reduce((total, row) => total + row.spentMinor, 0),
    budgetTargetMinor: trip.budgetTargetMinor,
    expenseCount: byCategory.reduce((total, row) => total + row.expenseCount, 0),
    byCategory,
  }
}

export interface MemberBalance {
  readonly userId: string
  /** What this member put on their own card. */
  readonly paidMinor: number
  /** What this member is responsible for after the splits. */
  readonly shareMinor: number
  readonly settledOutMinor: number
  readonly settledInMinor: number
  /** Positive: the trip owes them. Negative: they owe the trip. */
  readonly balanceMinor: number
}

/**
 * Per-member balance for a trip: `paid − share + settlements sent − settlements received`. Four
 * grouped reads, no per-member queries, and every member who appears anywhere in the money gets a row
 * even when one side of their ledger is empty.
 */
export async function getMemberBalances(
  scope: TenantScope,
  tripId: string,
): Promise<Array<MemberBalance>> {
  await requireTrip(scope, tripId)

  const [paidRows, shareRows, sentRows, receivedRows] = await Promise.all([
    scope.db
      .select({ userId: expenses.paidBy, total: sum(expenses.amountMinor) })
      .from(expenses)
      .where(tenantFilter(scope, expenses, eq(expenses.tripId, tripId)))
      .groupBy(expenses.paidBy),
    scope.db
      .select({ userId: expenseShares.userId, total: sum(expenseShares.shareMinor) })
      .from(expenseShares)
      .where(tenantFilter(scope, expenseShares, eq(expenseShares.tripId, tripId)))
      .groupBy(expenseShares.userId),
    scope.db
      .select({ userId: settlements.fromUserId, total: sum(settlements.amountMinor) })
      .from(settlements)
      .where(tenantFilter(scope, settlements, eq(settlements.tripId, tripId)))
      .groupBy(settlements.fromUserId),
    scope.db
      .select({ userId: settlements.toUserId, total: sum(settlements.amountMinor) })
      .from(settlements)
      .where(tenantFilter(scope, settlements, eq(settlements.tripId, tripId)))
      .groupBy(settlements.toUserId),
  ])

  const paid = toTotals(paidRows)
  const share = toTotals(shareRows)
  const sent = toTotals(sentRows)
  const received = toTotals(receivedRows)

  const userIds = [
    ...new Set([...paid.keys(), ...share.keys(), ...sent.keys(), ...received.keys()]),
  ]

  return userIds
    .map((userId) => {
      const paidMinor = paid.get(userId) ?? 0
      const shareMinor = share.get(userId) ?? 0
      const settledOutMinor = sent.get(userId) ?? 0
      const settledInMinor = received.get(userId) ?? 0
      return {
        userId,
        paidMinor,
        shareMinor,
        settledOutMinor,
        settledInMinor,
        balanceMinor: paidMinor - shareMinor + settledOutMinor - settledInMinor,
      }
    })
    .sort((left, right) => right.balanceMinor - left.balanceMinor)
}

function toTotals(
  rows: ReadonlyArray<{ userId: string | null; total: string | null }>,
): Map<string, number> {
  const totals = new Map<string, number>()
  for (const row of rows) {
    if (row.userId === null) {
      continue
    }
    totals.set(row.userId, (totals.get(row.userId) ?? 0) + Number(row.total ?? 0))
  }
  return totals
}

export interface SettlementSuggestion {
  readonly fromUserId: string
  readonly toUserId: string
  readonly amountMinor: number
}

/**
 * The shortest set of transfers that clears the trip: greedily match the biggest debtor against the
 * biggest creditor until every balance is zero. At most `members − 1` transfers.
 */
export async function suggestSettlements(
  scope: TenantScope,
  tripId: string,
): Promise<Array<SettlementSuggestion>> {
  const balances = await getMemberBalances(scope, tripId)
  const creditors = balances
    .filter((row) => row.balanceMinor > 0)
    .map((row) => ({ userId: row.userId, amount: row.balanceMinor }))
  const debtors = balances
    .filter((row) => row.balanceMinor < 0)
    .map((row) => ({ userId: row.userId, amount: -row.balanceMinor }))

  const suggestions: Array<SettlementSuggestion> = []
  let creditorIndex = 0
  let debtorIndex = 0

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors.at(creditorIndex)
    const debtor = debtors.at(debtorIndex)
    if (creditor === undefined || debtor === undefined) {
      break
    }
    const amountMinor = Math.min(creditor.amount, debtor.amount)
    if (amountMinor > 0) {
      suggestions.push({ fromUserId: debtor.userId, toUserId: creditor.userId, amountMinor })
    }
    creditor.amount -= amountMinor
    debtor.amount -= amountMinor
    if (creditor.amount === 0) {
      creditorIndex += 1
    }
    if (debtor.amount === 0) {
      debtorIndex += 1
    }
  }

  return suggestions
}

/** Daily spend for a trip, oldest first — the costs sparkline. */
export async function listDailySpend(
  scope: TenantScope,
  tripId: string,
): Promise<Array<{ readonly spentOn: string; readonly spentMinor: number }>> {
  const rows = await scope.db
    .select({ spentOn: expenses.spentOn, total: sum(expenses.amountMinor) })
    .from(expenses)
    .where(tenantFilter(scope, expenses, eq(expenses.tripId, tripId)))
    .groupBy(expenses.spentOn)
    .orderBy(asc(expenses.spentOn))
  return rows.map((row) => ({ spentOn: row.spentOn, spentMinor: Number(row.total ?? 0) }))
}
