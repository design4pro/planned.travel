/**
 * How a payment was made, as the reader names it.
 *
 * One map from the stored token to its catalogue key, read by the payment dialog's select and by
 * the rail's list of recorded payments, so the two cannot name a method differently. The key is
 * resolved where a translator is at hand, never here at module scope.
 */
import type { MessageKey, Translate } from '#/lib/i18n'
import type { SettlementMethod } from '#/server/fns/costs'

/** Exhaustive by construction: a method added to the schema is a compile error until it has a name. */
const METHOD_KEYS: Record<SettlementMethod, MessageKey> = {
  bank_transfer: 'costs.payment.method.bankTransfer',
  cash: 'costs.payment.method.cash',
  card: 'costs.payment.method.card',
  app: 'costs.payment.method.app',
  other: 'costs.payment.method.other',
}

/** The same keys, widened for a method retired from the schema that an old row still carries. */
const METHOD_LOOKUP: Record<string, MessageKey> = METHOD_KEYS

/** The presentation order of the payment dialog's select. */
export const SETTLEMENT_METHOD_OPTIONS: ReadonlyArray<{
  readonly value: SettlementMethod
  readonly label: MessageKey
}> = [
  { value: 'bank_transfer', label: METHOD_KEYS.bank_transfer },
  { value: 'cash', label: METHOD_KEYS.cash },
  { value: 'card', label: METHOD_KEYS.card },
  { value: 'app', label: METHOD_KEYS.app },
  { value: 'other', label: METHOD_KEYS.other },
]

/** An unknown method reads as "something else", never as the raw token. */
export function paymentMethodLabel(method: string, t: Translate): string {
  return t(METHOD_LOOKUP[method] ?? METHOD_KEYS.other)
}
