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
import { messageOf } from '#/components/modules/shared'
import { currencyRefusalOf } from '#/lib/currency-refusals'
import { useTranslate } from '#/lib/i18n'
import { impliedRate } from '#/lib/money'
import {
  createExpenseFn,
  deleteExpenseFn,
  deletePaymentFn,
  loadCosts,
  recordPaymentFn,
  setDisplayCurrencyFn,
  updateExpenseFn,
} from '#/server/fns/costs'

import type {
  CostsOp,
  CostsSnapshot,
  ExpenseFormValue,
  PaymentFormValue,
} from '#/components/costs'
import type {
  CostsExpense,
  CostsPayload,
  CostsSettlement,
} from '#/server/fns/costs'

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
  readonly removePayment: (payment: CostsSettlement) => Promise<void>
  /** Store the reader's display currency (`null` = each trip in its own) and reload the figures. */
  readonly setDisplay: (code: string | null) => Promise<void>
  readonly savingDisplay: boolean
}

/** The form's value as the row the list should show while the write is in flight. */
function optimisticExpense(
  id: string,
  value: ExpenseFormValue,
  currency: string,
  display: CostsPayload['displayCurrency'],
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
    convertedMinor: optimisticConverted(value.amountMinor, display),
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

/**
 * A row not yet on the server has no rate behind it, so in fixed mode it is not converted until the
 * loader answers; in per-trip mode the figure is the amount itself.
 */
function optimisticConverted(
  amountMinor: number,
  display: CostsPayload['displayCurrency'],
): number | null {
  return display.mode === 'per-trip' ? amountMinor : null
}

const COSTS_ROUTE_ID = '/_app/trips/$tripId/costs'

export function useCostsActions(payload: CostsPayload): CostsActions {
  const router = useRouter()
  const t = useTranslate()
  const [ops, setOps] = useState<ReadonlyArray<CostsOp>>([])
  const [savingDisplay, setSavingDisplay] = useState(false)

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
          // The refused row must not read as saved while the figures are fetched.
          drop(op.key)
          // The trip's current currency is asked for first, on its own: a reload that fails does not
          // reject, it swaps the screen (and the open dialog with what was typed) for the error
          // panel, so the screen is only reloaded once the server has answered. The filter keeps the
          // root loader out; the trip header loader and the `_app` guard still re-run, exactly as
          // after every successful save. `sync` makes the promise wait for the loader, where a
          // background reload would resolve while the old figures are still shown.
          const live = await loadCosts({ data: { tripId: payload.tripId } })
            .then((fresh) => fresh.currency)
            .catch(() => null)
          if (live !== null) {
            await router.invalidate({
              sync: true,
              filter: (match) => match.routeId === COSTS_ROUTE_ID,
            })
          }
          toast.error(
            live === null || live === payload.currency
              ? t('costs.expense.saveFailed')
              : t('costs.refusal.tripCurrencyChanged', { to: live }),
          )
        } else {
          toast.error(failure, {
            description: messageOf(cause, t('costs.write.rolledBack')),
          })
        }
        throw cause
      } finally {
        drop(op.key)
      }
    },
    [drop, payload.currency, payload.tripId, router, t],
  )

  const addExpense = useCallback(
    async (value: ExpenseFormValue): Promise<void> => {
      const key = optimisticId()
      await run(
        {
          kind: 'create',
          key,
          row: optimisticExpense(
            key,
            value,
            payload.currency,
            payload.displayCurrency,
          ),
        },
        () =>
          createExpenseFn({
            data: { tripId: payload.tripId, expense: toServerExpense(value) },
          }),
        t('costs.write.addFailed'),
      )
      toast.success(t('costs.write.added'), { description: value.title })
    },
    [payload.currency, payload.displayCurrency, payload.tripId, run, t],
  )

  const editExpense = useCallback(
    async (expense: CostsExpense, value: ExpenseFormValue): Promise<void> => {
      const key = optimisticId()
      await run(
        {
          kind: 'update',
          key,
          previous: expense,
          row: optimisticExpense(
            expense.id,
            value,
            payload.currency,
            payload.displayCurrency,
          ),
        },
        () =>
          updateExpenseFn({
            data: {
              tripId: payload.tripId,
              expenseId: expense.id,
              expense: toServerExpense(value),
            },
          }),
        t('costs.write.editFailed'),
      )
      toast.success(t('costs.write.updated'), { description: value.title })
    },
    [payload.currency, payload.displayCurrency, payload.tripId, run, t],
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
        t('costs.write.deleteFailed'),
      )
      toast.success(t('costs.write.deleted'), { description: expense.title })
    },
    [payload.tripId, run, t],
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
            convertedMinor: optimisticConverted(
              value.amountMinor,
              payload.displayCurrency,
            ),
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
        t('costs.write.paymentFailed'),
      )
      toast.success(t('costs.write.paymentRecorded'), {
        description: t('costs.write.paymentRecordedBody'),
      })
    },
    [payload.currency, payload.displayCurrency, payload.tripId, run, t],
  )

  const removePayment = useCallback(
    async (payment: CostsSettlement): Promise<void> => {
      const key = optimisticId()
      await run(
        { kind: 'unpay', key, previous: payment },
        () =>
          deletePaymentFn({
            data: { tripId: payload.tripId, settlementId: payment.id },
          }),
        t('costs.write.paymentDeleteFailed'),
      )
      toast.success(t('costs.write.paymentDeleted'), {
        description: t('costs.write.paymentRecordedBody'),
      })
    },
    [payload.tripId, run, t],
  )

  const setDisplay = useCallback(
    async (code: string | null): Promise<void> => {
      setSavingDisplay(true)
      try {
        await setDisplayCurrencyFn({ data: { code } })
        await router.invalidate()
      } catch {
        toast.error(t('costs.display.error.title'), {
          description: t('costs.display.error.body'),
        })
      } finally {
        setSavingDisplay(false)
      }
    },
    [router, t],
  )

  return {
    snapshot,
    addExpense,
    editExpense,
    removeExpense,
    addPayment,
    removePayment,
    setDisplay,
    savingDisplay,
  }
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
