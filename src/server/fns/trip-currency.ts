/**
 * Server functions for re-basing a trip's budget currency.
 *
 * Two calls: a read that says what changing the currency would do without writing anything, and the
 * commit that writes it. The Costs tab's "Change budget currency" dialog is the one screen that calls
 * them (`.ai/specs/2026-10-04-change-a-trips-accounting-currency.md`, phase 4).
 *
 * No SQL and no rule lives here. The guards (the owner of a trip that is not archived), the reads,
 * the rate lookup, the arithmetic and the atomic write are `src/server/repos/trip-currency`; this
 * module validates the request, hands it a tenant scope, and after the commit records it in the
 * audit trail and tells the trip room.
 */
import { createServerFn } from '@tanstack/react-start'

import { AUDIT_ACTIONS, trail } from '#/server/audit/trail'
import {
  changeTripCurrency,
  changeTripCurrencyRequest,
  previewCurrencyChange,
  previewCurrencyChangeRequest,
} from '#/server/repos'
import { appScope, mirrorToRoom, patch } from './context'

import type { CurrencyChangePreview } from '#/server/repos'

/** What the commit answers: the counts it wrote, for the dialog's confirmation line. */
export interface CurrencyChangeResult {
  readonly from: string
  readonly to: string
  readonly rate: number | null
  readonly expenses: number
  readonly settlements: number
  readonly budgetItems: number
}

/**
 * What changing the trip's budget currency to `to` would do, at the owner's `rate` or else the last
 * rate this workspace froze for the pair. Refusals come back as data in `refusal`, never as an
 * error message; the owner-only and archived-trip refusals are errors, as for every trip write.
 */
export const previewCurrencyChangeFn = createServerFn({ method: 'GET' })
  .validator(previewCurrencyChangeRequest)
  .handler(async ({ data }): Promise<CurrencyChangePreview> =>
    previewCurrencyChange(await appScope(), data.tripId, {
      to: data.to,
      rate: data.rate,
    }),
  )

/**
 * Re-bases the trip's budget currency to `to` at the `rate` the owner previewed and confirmed. It
 * looks no rate up and writes in one atomic batch (`changeTripCurrency`); anything that moved since
 * the preview is the `costs.refusal.rebaseChanged` refusal and nothing is written.
 *
 * After the commit, never before it: the audit row says what was written, and the trip room is told
 * the trip's currency and budget target changed so every open tab re-reads its figures.
 */
export const changeTripCurrencyFn = createServerFn({ method: 'POST' })
  .validator(changeTripCurrencyRequest)
  .handler(async ({ data }): Promise<CurrencyChangeResult> => {
    const scope = await appScope()
    const change = await changeTripCurrency(scope, data.tripId, {
      to: data.to,
      rate: data.rate,
      from: data.from,
    })

    await mirrorToRoom(scope, data.tripId, [
      patch('trip', data.tripId, {
        currency: change.to,
        budgetTargetMinor: change.budgetTarget?.after ?? null,
        expensesChangedAt: Date.now(),
      }),
    ])
    await trail(scope, {
      action: AUDIT_ACTIONS.TRIP_CURRENCY_CHANGED,
      entityType: 'trip',
      entityId: data.tripId,
      metadata: {
        from: change.from,
        to: change.to,
        rate: change.rate,
        expenses: change.counts.expenses,
        settlements: change.counts.settlements,
        budgetItems: change.counts.budgetItems,
        pinnedPrices: change.counts.pinnedPrices,
        budgetTargetBefore: change.budgetTarget?.before ?? null,
        budgetTargetAfter: change.budgetTarget?.after ?? null,
      },
    })
    return {
      from: change.from,
      to: change.to,
      rate: change.rate,
      expenses: change.counts.expenses,
      settlements: change.counts.settlements,
      budgetItems: change.counts.budgetItems,
    }
  })
