/**
 * The write path for the costs screen.
 *
 * Mutations in the loaded currency reach the screen first and the server second. The
 * optimistic row is not a guess: it carries the split the editor already computed
 * with the same algorithm the repository uses, so when the loader answers, the
 * figures do not move.
 *
 * Failure rolls the operation out of the queue and re-throws, so the dialog that
 * started it can show the reason inline and stay open with the reader's input
 * intact. A toast alone would leave them staring at a list that silently reverted.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'

import { applyOps, optimisticId } from '#/components/costs'
import { messageOf } from '#/components/modules/shared'
import { requireFound } from '#/lib/absence'
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
  /** The current currency for this money-dialog session. */
  readonly currency: string
  readonly suggestedRate: CostsPayload['suggestedRate']
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

export function useCostsActions(
  payload: CostsPayload,
  moneySession: number | null = null,
): CostsActions {
  const router = useRouter()
  const t = useTranslate()
  const [ops, setOps] = useState<ReadonlyArray<CostsOp>>([])
  const [savingDisplay, setSavingDisplay] = useState(false)

  const session = useRef({ id: moneySession, tripId: payload.tripId })
  session.current = { id: moneySession, tripId: payload.tripId }
  const [probed, setProbed] = useState<{
    id: number
    tripId: string
    currency: string
  } | null>(null)
  const currency =
    probed?.id === moneySession && probed.tripId === payload.tripId
      ? probed.currency
      : payload.currency
  const [deferred, setDeferred] = useState<{
    needed: boolean
    keys: ReadonlyArray<string>
  }>({
    needed: false,
    keys: [],
  })

  const snapshot = useMemo(() => applyOps(payload, ops), [payload, ops])

  const drop = useCallback((key: string): void => {
    setOps((current) => current.filter((op) => op.key !== key))
  }, [])

  useEffect(() => {
    if (moneySession !== null || !deferred.needed) return
    const { keys } = deferred
    setDeferred({ needed: false, keys: [] })
    // The dialog has rendered closed. A reconciliation failure cannot undo a committed write.
    void router
      .invalidate({ sync: true })
      .catch(() => undefined)
      .finally(() => keys.forEach(drop))
  }, [moneySession, deferred, router, drop])

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
      const started = session.current
      // Amounts in a newly probed currency cannot be added to the old loader totals.
      if (currency === payload.currency) setOps((current) => [...current, op])
      let committed = false
      try {
        await send()
        committed = true
        if (started.id !== null) {
          setDeferred((current) => ({
            needed: true,
            keys: [...current.keys, op.key],
          }))
          return
        }
        await router.invalidate().catch(() => undefined)
      } catch (cause) {
        if (currencyRefusalOf(cause) === 'costs.refusal.tripCurrencyChanged') {
          // The refused row must not read as saved while the figures are fetched.
          drop(op.key)
          if (started.id !== null)
            setDeferred((current) => ({ ...current, needed: true }))
          const live = await loadCosts({ data: { tripId: payload.tripId } })
            .then((fresh) => requireFound(fresh).currency)
            .catch(() => null)
          if (
            session.current.id !== started.id ||
            session.current.tripId !== started.tripId
          )
            throw cause
          if (live !== null && started.id !== null) {
            setProbed({
              id: started.id,
              tripId: started.tripId,
              currency: live,
            })
          }
          toast.error(
            live === null || live === currency
              ? t('costs.expense.saveFailed')
              : t('costs.refusal.tripCurrencyChanged', { to: live }),
            { position: 'top-center' },
          )
        } else {
          toast.error(failure, {
            description: messageOf(cause, t('costs.write.rolledBack')),
          })
        }
        throw cause
      } finally {
        if (!committed || started.id === null) drop(op.key)
      }
    },
    [drop, currency, payload.currency, payload.tripId, router, t],
  )

  const addExpense = useCallback(
    async (value: ExpenseFormValue): Promise<void> => {
      const key = optimisticId()
      await run(
        {
          kind: 'create',
          key,
          row: optimisticExpense(key, value, currency, payload.displayCurrency),
        },
        () =>
          createExpenseFn({
            data: { tripId: payload.tripId, expense: toServerExpense(value) },
          }),
        t('costs.write.addFailed'),
      )
      toast.success(t('costs.write.added'), { description: value.title })
    },
    [currency, payload.displayCurrency, payload.tripId, run, t],
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
            currency,
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
    [currency, payload.displayCurrency, payload.tripId, run, t],
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
            currency,
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
              expectedTripCurrency: currency,
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
    [currency, payload.displayCurrency, payload.tripId, run, t],
  )

  const removePayment = useCallback(
    async (payment: CostsSettlement): Promise<void> => {
      const key = optimisticId()
      await run(
        { kind: 'unpay', key, previous: payment },
        () =>
          deletePaymentFn({
            data: { tripId: payload.tripId, settlementId: payment.id },
          }).catch(async (cause: unknown) => {
            // A refusal, a lost response and a payment someone else already removed all arrive as
            // the same failure, and "try again" is wrong for the last two. Only the server knows
            // which, so ask it: a payment that is no longer there is what the person wanted.
            const gone = await loadCosts({ data: { tripId: payload.tripId } })
              .then((fresh) =>
                requireFound(fresh).settlements.every(
                  (row) => row.id !== payment.id,
                ),
              )
              .catch(() => false)
            if (!gone) throw cause
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
        // The choice is stored from here on. A reload that fails does not reject in the router (it
        // swaps the screen for the error panel), and one that does must not read as "not saved".
        await router.invalidate().catch(() => undefined)
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
    currency,
    // Loader rates convert into its budget currency, never into a newly probed one.
    suggestedRate: currency === payload.currency ? payload.suggestedRate : null,
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
