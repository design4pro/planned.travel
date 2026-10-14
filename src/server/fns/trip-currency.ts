/**
 * Server functions for re-basing a trip's budget currency.
 *
 * Today one read: what changing the currency would do, without writing anything. No screen reaches
 * it yet; the commit and the Costs dialog that confirm it are later tickets of the same spec
 * (`.ai/specs/2026-10-04-change-a-trips-accounting-currency.md`).
 *
 * No SQL and no rule lives here. The guards (the owner of a trip that is not archived), the reads,
 * the rate lookup and the arithmetic are `src/server/repos/trip-currency`; this module validates
 * the request and hands it a tenant scope.
 */
import { createServerFn } from '@tanstack/react-start'

import {
  previewCurrencyChange,
  previewCurrencyChangeRequest,
} from '#/server/repos'
import { appScope } from './context'

import type { CurrencyChangePreview } from '#/server/repos'

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
