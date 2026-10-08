/**
 * Server functions for the Costs module.
 *
 * One read that assembles everything the screen needs in a single round trip, and
 * four writes. Every handler obtains a tenant scope first, so a trip id belonging
 * to another organisation becomes a 404 before a single expense row is touched —
 * the repository layer's guarantee, surfaced at the route boundary.
 *
 * No SQL lives here. Reads and writes both go through `src/server/repos/expenses`,
 * which owns the split arithmetic, the balance aggregates and the settlement
 * suggestions. This module's only job is validation, shaping and serialisation.
 *
 * One exception to "shaping only": a new expense notifies the travellers it
 * charged, through `dispatchQuietly`, which cannot fail the save.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
  EXPENSE_CATEGORIES,
  SETTLEMENT_METHODS,
  SPLIT_METHODS,
} from '#/server/db/schema'
import {
  createExpense,
  createSettlement,
  deleteExpense,
  getExpenseWithShares,
  getMemberBalances,
  getTripSpendSummary,
  listSettlements,
  listTripExpenses,
  listTripMembers,
  listUserProfiles,
  requireTrip,
  suggestSettlements,
  updateExpense,
} from '#/server/repos'
import { impliedRate } from '#/lib/money'
import { dispatchQuietly } from '#/server/notifications/dispatch'
import {
  appScope,
  mirrorToRoom,
  notificationDeps,
  patch,
  tombstone,
} from './context'

import type { ExpenseShare, Trip } from '#/server/db/types'
import type { TenantScope } from '#/server/repos'

/* -------------------------------------------------------------------------- */
/* Shapes                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The enum unions, re-exported as types so the client can be narrowly typed
 * without importing the Drizzle schema — which would drag the ORM into the browser
 * bundle. A category list on the client that drifts from the schema fails to
 * compile against these, which is the point.
 */
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]
export type SettlementMethod = (typeof SETTLEMENT_METHODS)[number]
export type SplitMethodName = (typeof SPLIT_METHODS)[number]

export interface CostsPerson {
  readonly userId: string
  readonly name: string
  readonly email: string
  readonly image: string | null
  readonly role: string
}

export interface CostsShare {
  readonly userId: string
  readonly shareMinor: number
  readonly weight: number
  readonly isSettled: boolean
}

export interface CostsExpense {
  readonly id: string
  readonly title: string
  readonly category: string
  readonly amountMinor: number
  readonly currency: string
  readonly originalAmountMinor: number | null
  readonly originalCurrency: string | null
  readonly exchangeRate: number | null
  readonly spentOn: string
  readonly paidBy: string | null
  readonly splitMethod: string
  readonly notes: string | null
  readonly shares: ReadonlyArray<CostsShare>
}

export interface CostsBalance {
  readonly userId: string
  readonly paidMinor: number
  readonly shareMinor: number
  readonly settledOutMinor: number
  readonly settledInMinor: number
  readonly balanceMinor: number
}

export interface CostsSettlement {
  readonly id: string
  readonly fromUserId: string
  readonly toUserId: string
  readonly amountMinor: number
  readonly currency: string
  readonly method: string
  readonly settledOn: string
  readonly note: string | null
}

export interface CostsSuggestion {
  readonly fromUserId: string
  readonly toUserId: string
  readonly amountMinor: number
}

export interface CostsCategoryTotal {
  readonly category: string
  readonly plannedMinor: number
  readonly spentMinor: number
  readonly expenseCount: number
}

export interface CostsPayload {
  readonly tripId: string
  readonly currency: string
  readonly today: string
  readonly startDate: string | null
  readonly endDate: string | null
  readonly plannedMinor: number
  readonly spentMinor: number
  readonly budgetTargetMinor: number | null
  readonly expenseCount: number
  readonly byCategory: ReadonlyArray<CostsCategoryTotal>
  readonly expenses: ReadonlyArray<CostsExpense>
  readonly balances: ReadonlyArray<CostsBalance>
  readonly settlements: ReadonlyArray<CostsSettlement>
  readonly suggestions: ReadonlyArray<CostsSuggestion>
  readonly people: ReadonlyArray<CostsPerson>
  readonly viewerUserId: string
}

/* -------------------------------------------------------------------------- */
/* Inputs                                                                     */
/* -------------------------------------------------------------------------- */

const tripIdSchema = z.string().trim().min(1).max(64)
const idSchema = z.string().trim().min(1).max(64)
const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date.')
const minorSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)

/**
 * A traveller's stake in one expense. Exactly one of the three unit fields is
 * meaningful, decided by the expense's split method; the repository ignores the
 * rest, so sending all three would be harmless but sending none is a bug the
 * schema will not catch — which is why the client only ever sends the right one.
 */
const participantSchema = z.object({
  userId: idSchema,
  weight: z.number().finite().min(0).max(1000).optional(),
  shareMinor: minorSchema.optional(),
  percentage: z.number().finite().min(0).max(100).optional(),
})

const expenseBodySchema = z.object({
  title: z.string().trim().min(1).max(160),
  category: z.enum(EXPENSE_CATEGORIES),
  amountMinor: minorSchema,
  /** Absent means "the trip's own currency", which the handler resolves. */
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Za-z]{3}$/)
    .optional(),
  originalAmountMinor: minorSchema.nullable(),
  originalCurrency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Za-z]{3}$/)
    .nullable(),
  spentOn: dateSchema,
  /** An empty string is the "nobody has claimed this yet" sentinel from the form. */
  paidBy: idSchema.nullable(),
  splitMethod: z.enum(SPLIT_METHODS),
  notes: z.string().trim().max(4000).nullable(),
  participants: z.array(participantSchema).max(100),
})

const createExpenseSchema = z.object({
  tripId: tripIdSchema,
  expense: expenseBodySchema,
})

const updateExpenseSchema = z.object({
  tripId: tripIdSchema,
  expenseId: idSchema,
  expense: expenseBodySchema,
})

const deleteExpenseSchema = z.object({
  tripId: tripIdSchema,
  expenseId: idSchema,
})

const recordPaymentSchema = z.object({
  tripId: tripIdSchema,
  fromUserId: idSchema,
  toUserId: idSchema,
  amountMinor: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  method: z.enum(SETTLEMENT_METHODS),
  settledOn: dateSchema,
  note: z.string().trim().max(500).nullable(),
})

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

async function loadPeople(
  scope: TenantScope,
  tripId: string,
): Promise<Array<CostsPerson>> {
  const members = await listTripMembers(scope, tripId)
  const profiles = await listUserProfiles(
    scope,
    members.map((row) => row.userId),
  )
  const byUser = new Map(profiles.map((row) => [row.userId, row]))

  return members.map((row) => {
    const profile = byUser.get(row.userId)
    return {
      userId: row.userId,
      name: profile?.name ?? 'Removed traveller',
      email: profile?.email ?? '',
      image: profile?.image ?? null,
      role: row.role,
    }
  })
}

/**
 * Tells the travellers an expense actually charged that it exists.
 *
 * The audience is the split, not the trip: a member with no share owes nothing and has no reason
 * to hear about it. It still narrows rather than names — `dispatch` intersects it with the trip's
 * membership, so a participant id that is not a member of this trip reaches nobody.
 *
 * Wrapped like `mirrorToRoom`: the expense is already in D1 by the time this runs, so a
 * notification that cannot be delivered must not turn a successful save into a failed one.
 */
async function notifyChargedMembers(
  scope: TenantScope,
  trip: Trip,
  expense: { readonly id: string; readonly title: string },
  shares: ReadonlyArray<ExpenseShare>,
): Promise<void> {
  const charged = shares
    .filter((row) => row.shareMinor > 0)
    .map((row) => row.userId)
  if (charged.length === 0) {
    return
  }
  await dispatchQuietly(
    scope,
    {
      kind: 'expense.added',
      tripId: trip.id,
      entityType: 'expense',
      entityId: expense.id,
      actorUserId: scope.ctx.userId,
      scope: 'trip',
      audienceUserIds: charged,
      bodyParams: { title: expense.title, tripTitle: trip.title },
      actionUrl: `/trips/${trip.id}/costs`,
    },
    notificationDeps(),
  )
}

function toShare(row: ExpenseShare): CostsShare {
  return {
    userId: row.userId,
    shareMinor: row.shareMinor,
    weight: row.weight,
    isSettled: row.isSettled,
  }
}

type ExpenseBody = z.infer<typeof expenseBodySchema>

/**
 * Form values into the repository's create/update input.
 *
 * A source currency that matches the trip's own is dropped: `original_currency`
 * exists to record that a receipt was written in a *different* currency, and
 * storing `JPY → JPY` would make every row claim a conversion it never had.
 */
function toRepoInput(
  body: ExpenseBody,
  tripCurrency: string,
): {
  readonly category: (typeof EXPENSE_CATEGORIES)[number]
  readonly title: string
  readonly amountMinor: number
  readonly currency: string
  readonly originalAmountMinor: number | null
  readonly originalCurrency: string | null
  readonly exchangeRate: number | null
  readonly spentOn: string
  readonly paidBy: string | null
  readonly splitMethod: (typeof SPLIT_METHODS)[number]
  readonly notes: string | null
  readonly participants: Array<z.infer<typeof participantSchema>>
} {
  const currency = (body.currency ?? tripCurrency).toUpperCase()
  const original = body.originalCurrency?.toUpperCase() ?? null
  const foreign = original !== null && original !== currency
  const originalAmountMinor = foreign ? body.originalAmountMinor : null

  return {
    category: body.category,
    title: body.title,
    amountMinor: body.amountMinor,
    currency,
    originalAmountMinor,
    originalCurrency: foreign ? original : null,
    // Derived rather than trusted from the client: an amount pair and a rate that
    // disagreed would put a lie under the row, and the amounts are the half the
    // reader can actually see. Stored in major units — 195 JPY to the pound, not
    // the minor-unit ratio, which would read as 1.95.
    exchangeRate: impliedRate({
      originalAmountMinor,
      originalCurrency: foreign ? original : null,
      amountMinor: body.amountMinor,
      currency,
    }),
    spentOn: body.spentOn,
    paidBy: body.paidBy,
    splitMethod: body.splitMethod,
    notes: body.notes === null || body.notes === '' ? null : body.notes,
    participants: body.participants,
  }
}

/* -------------------------------------------------------------------------- */
/* Read                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Everything the costs screen renders, in one request.
 *
 * The five aggregate reads are issued together rather than in sequence: they are
 * independent, and a screen that opens with four stat tiles has no reason to pay
 * for four serial round trips to D1.
 */
export const loadCosts = createServerFn({ method: 'GET' })
  .validator(z.object({ tripId: tripIdSchema }))
  .handler(async ({ data }): Promise<CostsPayload> => {
    const scope = await appScope()
    const trip = await requireTrip(scope, data.tripId)

    const [summary, rows, balances, settled, suggestions, people] =
      await Promise.all([
        getTripSpendSummary(scope, trip.id),
        listTripExpenses(scope, trip.id),
        getMemberBalances(scope, trip.id),
        listSettlements(scope, trip.id),
        suggestSettlements(scope, trip.id),
        loadPeople(scope, trip.id),
      ])

    // The split rows are what make "your share" honest on every line, so they are
    // fetched per expense rather than inferred from the balance aggregate.
    const withShares = await Promise.all(
      rows.map((row) => getExpenseWithShares(scope, row.id)),
    )

    return {
      tripId: trip.id,
      currency: summary.currency,
      today: todayIso(),
      startDate: trip.startDate,
      endDate: trip.endDate,
      plannedMinor: summary.plannedMinor,
      spentMinor: summary.spentMinor,
      budgetTargetMinor: summary.budgetTargetMinor,
      expenseCount: summary.expenseCount,
      byCategory: summary.byCategory.map((row) => ({
        category: row.category,
        plannedMinor: row.plannedMinor,
        spentMinor: row.spentMinor,
        expenseCount: row.expenseCount,
      })),
      people,
      viewerUserId: scope.ctx.userId,
      expenses: withShares.map(({ expense, shares }) => ({
        id: expense.id,
        title: expense.title,
        category: expense.category,
        amountMinor: expense.amountMinor,
        currency: expense.currency,
        originalAmountMinor: expense.originalAmountMinor,
        originalCurrency: expense.originalCurrency,
        exchangeRate: expense.exchangeRate,
        spentOn: expense.spentOn,
        paidBy: expense.paidBy,
        splitMethod: expense.splitMethod,
        notes: expense.notes,
        shares: shares.map(toShare),
      })),
      balances: balances.map((row) => ({
        userId: row.userId,
        paidMinor: row.paidMinor,
        shareMinor: row.shareMinor,
        settledOutMinor: row.settledOutMinor,
        settledInMinor: row.settledInMinor,
        balanceMinor: row.balanceMinor,
      })),
      settlements: settled.map((row) => ({
        id: row.id,
        fromUserId: row.fromUserId,
        toUserId: row.toUserId,
        amountMinor: row.amountMinor,
        currency: row.currency,
        method: row.method,
        settledOn: row.settledOn,
        note: row.note,
      })),
      suggestions: suggestions.map((row) => ({
        fromUserId: row.fromUserId,
        toUserId: row.toUserId,
        amountMinor: row.amountMinor,
      })),
    }
  })

/* -------------------------------------------------------------------------- */
/* Writes                                                                     */
/* -------------------------------------------------------------------------- */

export const createExpenseFn = createServerFn({ method: 'POST' })
  .validator(createExpenseSchema)
  .handler(async ({ data }): Promise<{ readonly expenseId: string }> => {
    const scope = await appScope()
    const trip = await requireTrip(scope, data.tripId)
    const { expense, shares } = await createExpense(scope, {
      tripId: trip.id,
      ...toRepoInput(data.expense, trip.currency),
    })

    await mirrorToRoom(scope, trip.id, [
      patch('expense', expense.id, {
        title: expense.title,
        amountMinor: expense.amountMinor,
        spentOn: expense.spentOn,
      }),
    ])
    await notifyChargedMembers(scope, trip, expense, shares)
    return { expenseId: expense.id }
  })

export const updateExpenseFn = createServerFn({ method: 'POST' })
  .validator(updateExpenseSchema)
  .handler(async ({ data }): Promise<{ readonly expenseId: string }> => {
    const scope = await appScope()
    const trip = await requireTrip(scope, data.tripId)
    const { expense } = await updateExpense(scope, trip.id, data.expenseId, {
      ...toRepoInput(data.expense, trip.currency),
    })

    await mirrorToRoom(scope, trip.id, [
      patch('expense', expense.id, {
        title: expense.title,
        amountMinor: expense.amountMinor,
        spentOn: expense.spentOn,
      }),
    ])
    return { expenseId: expense.id }
  })

export const deleteExpenseFn = createServerFn({ method: 'POST' })
  .validator(deleteExpenseSchema)
  .handler(async ({ data }): Promise<{ readonly expenseId: string }> => {
    const scope = await appScope()
    // The trip is checked first, then the expense is looked up inside it, so an id from
    // another tenant or from another trip is a 404 rather than a delete.
    const trip = await requireTrip(scope, data.tripId)
    await deleteExpense(scope, trip.id, data.expenseId)

    await mirrorToRoom(scope, trip.id, [tombstone('expense', data.expenseId)])
    return { expenseId: data.expenseId }
  })

export const recordPaymentFn = createServerFn({ method: 'POST' })
  .validator(recordPaymentSchema)
  .handler(async ({ data }): Promise<{ readonly settlementId: string }> => {
    const scope = await appScope()
    const trip = await requireTrip(scope, data.tripId)
    const settlement = await createSettlement(scope, {
      tripId: trip.id,
      fromUserId: data.fromUserId,
      toUserId: data.toUserId,
      amountMinor: data.amountMinor,
      currency: trip.currency,
      method: data.method,
      settledOn: data.settledOn,
      note: data.note,
    })

    // A settlement moves two balances but is not itself an expense row, so the
    // room is told the trip's money changed rather than handed a phantom entity.
    await mirrorToRoom(scope, trip.id, [
      patch('trip', trip.id, { expensesChangedAt: Date.now() }),
    ])
    return { settlementId: settlement.id }
  })
