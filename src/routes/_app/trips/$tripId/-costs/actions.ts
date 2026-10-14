/**
 * The write path for the costs screen.
 *
 * Every mutation is applied to the screen first and to the server second. The
 * optimistic row is not a guess: it carries the split the editor already computed
 * with the same algorithm the repository uses, so when the loader answers, the
 * figures do not move.
 *
 * Failure rolls the operation out of the queue and re-throws, so the dialog that
 * started it can show the reason inline and stay open with the reader's input
 * intact. A toast alone would leave them staring at a list that silently reverted.
 */
import { useCallback, useMemo, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'

import { applyOps, optimisticId } from '#/components/costs'
import { currencyRefusalOf } from '#/lib/currency-refusals'
import { impliedRate } from '#/lib/money'
import {
  createExpenseFn,
  deleteExpenseFn,
  recordPaymentFn,
  updateExpenseFn,
} from '#/server/fns/costs'

import type {
  CostsOp,
  CostsSnapshot,
  ExpenseFormValue,
  PaymentFormValue,
} from '#/components/costs'
import type { CostsExpense, CostsPayload } from '#/server/fns/costs'

export interface CostsActions {
  /** The payload with any in-flight writes folded in. */
  readonly snapshot: CostsSnapshot
  readonly addExpense: (value: ExpenseFormValue) => Promise<void>
  readonly editExpense: (
    expense: CostsExpense,
    value: ExpenseFormValue,
  ) => Promise<void>
  readonly removeExpense: (expense: CostsExpense) => Promise<void>
  readonly addPayment: (value: PaymentFormValue) => Promise<void>
}

/** The form's value as the row the list should show while the write is in flight. */
function optimisticExpense(
  id: string,
  value: ExpenseFormValue,
  currency: string,
): CostsExpense {
  return {
    id,
    title: value.title,
    category: value.category,
    amountMinor: value.amountMinor,
    currency,
    originalAmountMinor: value.originalAmountMinor,
    originalCurrency: value.originalCurrency,
    exchangeRate: impliedRate({
      originalAmountMinor: value.originalAmountMinor,
      originalCurrency: value.originalCurrency,
      amountMinor: value.amountMinor,
      currency,
    }),
    spentOn: value.spentOn,
    paidBy: value.paidBy,
    splitMethod: value.splitMethod,
    notes: value.notes,
    shares: value.shares.map((share) => ({
      userId: share.userId,
      shareMinor: share.shareMinor,
      weight: share.weight,
      isSettled: false,
    })),
  }
}

function reasonOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : fallback
}

export function useCostsActions(payload: CostsPayload): CostsActions {
  const router = useRouter()
  const [ops, setOps] = useState<ReadonlyArray<CostsOp>>([])

  const snapshot = useMemo(() => applyOps(payload, ops), [payload, ops])

  const drop = useCallback((key: string): void => {
    setOps((current) => current.filter((op) => op.key !== key))
  }, [])

  /**
   * Queue the operation, send it, then reconcile.
   *
   * The op is dropped *after* the loader has answered, not before: dropping it
   * first would show the pre-write list for one frame, which reads as the write
   * having failed.
   */
  const run = useCallback(
    async (
      op: CostsOp,
      send: () => Promise<unknown>,
      failure: string,
    ): Promise<void> => {
      setOps((current) => [...current, op])
      try {
        await send()
        await router.invalidate()
      } catch (cause) {
        if (currencyRefusalOf(cause) === 'costs.refusal.tripCurrencyChanged') {
          // The dialog names the new currency beside the figure, so the screen is refreshed here,
          // before the refusal reaches it, and the toast only says what did not happen.
          await router.invalidate()
          toast.error(failure)
        } else {
          toast.error(failure, {
            description: reasonOf(cause, 'The change was rolled back.'),
          })
        }
        throw cause
      } finally {
        drop(op.key)
      }
    },
    [drop, router],
  )

  const addExpense = useCallback(
    async (value: ExpenseFormValue): Promise<void> => {
      const key = optimisticId()
      await run(
        {
          kind: 'create',
          key,
          row: optimisticExpense(key, value, payload.currency),
        },
        () =>
          createExpenseFn({
            data: { tripId: payload.tripId, expense: toServerExpense(value) },
          }),
        'The expense was not added',
      )
      toast.success('Expense added', { description: value.title })
    },
    [payload.currency, payload.tripId, run],
  )

  const editExpense = useCallback(
    async (expense: CostsExpense, value: ExpenseFormValue): Promise<void> => {
      const key = optimisticId()
      await run(
        {
          kind: 'update',
          key,
          previous: expense,
          row: optimisticExpense(expense.id, value, payload.currency),
        },
        () =>
          updateExpenseFn({
            data: {
              tripId: payload.tripId,
              expenseId: expense.id,
              expense: toServerExpense(value),
            },
          }),
        'The expense was not saved',
      )
      toast.success('Expense updated', { description: value.title })
    },
    [payload.currency, payload.tripId, run],
  )

  const removeExpense = useCallback(
    async (expense: CostsExpense): Promise<void> => {
      const key = optimisticId()
      await run(
        { kind: 'delete', key, previous: expense },
        () =>
          deleteExpenseFn({
            data: { tripId: payload.tripId, expenseId: expense.id },
          }),
        'The expense was not deleted',
      )
      toast.success('Expense deleted', { description: expense.title })
    },
    [payload.tripId, run],
  )

  const addPayment = useCallback(
    async (value: PaymentFormValue): Promise<void> => {
      const key = optimisticId()
      await run(
        {
          kind: 'payment',
          key,
          row: {
            id: key,
            fromUserId: value.fromUserId,
            toUserId: value.toUserId,
            amountMinor: value.amountMinor,
            currency: payload.currency,
            method: value.method,
            settledOn: value.settledOn,
            note: value.note,
          },
        },
        () =>
          recordPaymentFn({
            data: {
              tripId: payload.tripId,
              expectedTripCurrency: payload.currency,
              fromUserId: value.fromUserId,
              toUserId: value.toUserId,
              amountMinor: value.amountMinor,
              originalAmountMinor: value.originalAmountMinor,
              originalCurrency: value.originalCurrency,
              method: value.method,
              settledOn: value.settledOn,
              note: value.note,
            },
          }),
        'The payment was not recorded',
      )
      toast.success('Payment recorded', {
        description: 'Both balances are updated.',
      })
    },
    [payload.currency, payload.tripId, run],
  )

  return { snapshot, addExpense, editExpense, removeExpense, addPayment }
}

/**
 * The form value as the server function's validator wants it.
 *
 * Only the participant array needs reshaping — it arrives readonly from the form
 * and the validator wants a mutable array. Everything else is already narrowly
 * typed, because the dialog is typed against the schema's own enum unions.
 */
function toServerExpense(value: ExpenseFormValue): {
  readonly title: string
  readonly category: ExpenseFormValue['category']
  readonly amountMinor: number
  readonly currency: string
  readonly originalAmountMinor: number | null
  readonly originalCurrency: string | null
  readonly spentOn: string
  readonly paidBy: string | null
  readonly splitMethod: ExpenseFormValue['splitMethod']
  readonly notes: string | null
  readonly participants: Array<{
    readonly userId: string
    readonly weight?: number
    readonly shareMinor?: number
    readonly percentage?: number
  }>
} {
  return {
    title: value.title,
    category: value.category,
    amountMinor: value.amountMinor,
    currency: value.currency,
    originalAmountMinor: value.originalAmountMinor,
    originalCurrency: value.originalCurrency,
    spentOn: value.spentOn,
    paidBy: value.paidBy,
    splitMethod: value.splitMethod,
    notes: value.notes,
    participants: [...value.participants],
  }
}
