/**
 * What a failed billing action says on the Billing screen.
 *
 * Every action on the screen (plan change, promotion code, portal, invoice) fails through the
 * global redaction middleware, so what reaches here is the public-failure envelope and nothing
 * else. It is read with the shared `readPublicFailure`, never by looking at the message text: a
 * refusal or validation failure carries a sentence the server wrote, and an unexpected failure
 * carries a reference and, sometimes, one constant code from a closed list that is resolved to
 * localised copy below. Anything that is not an envelope - a client-side throw, a code from a
 * newer server - gets the generic sentence, because it could be a provider diagnostic and this
 * screen must not print one.
 */

import { readPublicFailure } from '#/lib/errors'

import type { PublicFailureCode } from '#/lib/errors'
import type { MessageKey, Translate } from '#/lib/i18n'

/** The sentence a billing code stands for. Codes that are not billing's are absent on purpose. */
const BILLING_COPY: Readonly<Partial<Record<PublicFailureCode, MessageKey>>> = {
  BILLING_FORBIDDEN: 'settings.billing.failure.forbidden',
  BILLING_PROVIDER_REFUSED: 'settings.billing.failure.providerRefused',
  BILLING_RATE_LIMITED: 'settings.billing.failure.rateLimited',
  BILLING_NOT_CONNECTED: 'settings.billing.failure.notConnected',
  BILLING_ORDER_NOT_INVOICEABLE: 'settings.billing.failure.orderNotInvoiceable',
}

/** A sentence for an alert, and whether the server wrote it. */
export interface BillingFailure {
  readonly message: string
  /**
   * True only for a refusal or validation sentence from the server, which is English whatever
   * the locale (`docs/SPEC.md` §9 rule 10), so a screen marks it `lang="en"`.
   */
  readonly authored: boolean
}

export function readBillingFailure(
  t: Translate,
  cause: unknown,
): BillingFailure {
  const failure = readPublicFailure(cause)

  if (failure.kind !== 'unexpected' && failure.message !== undefined) {
    return { message: failure.message, authored: true }
  }

  const sentence = t(
    (failure.code === undefined ? undefined : BILLING_COPY[failure.code]) ??
      'settings.billing.provider.rejected',
  )
  const message =
    failure.reference === undefined
      ? sentence
      : `${sentence} ${t('settings.billing.failure.reference', { reference: failure.reference })}`

  return { message, authored: false }
}
