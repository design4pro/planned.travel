import { describe, expect, it } from 'vitest'

import { encodePublicFailure } from '#/lib/errors'

import { readBillingFailure } from '../billing-failure'

import type { PublicFailure } from '#/lib/errors'
import type { Translate } from '#/lib/i18n'

/**
 * What a failed billing action says on screen, measured through the real envelope reader.
 *
 * The translator echoes `key|reference` so an assertion names the sentence that was chosen
 * without a catalogue, and shows that a reference reached the sentence that carries it.
 */
function echo(key: string, ...args: ReadonlyArray<unknown>): string {
  const [values] = args
  const reference =
    typeof values === 'object' && values !== null && 'reference' in values
      ? `|${String(values.reference)}`
      : ''
  return `${key}${reference}`
}
const t: Translate = echo

function arrived(failure: PublicFailure): Error {
  return new Error(encodePublicFailure(failure))
}

const REFERENCE = 'e6d9e6f2af034cd89c4f6efc9d5af2e6'

describe('readBillingFailure', () => {
  it.each([
    ['BILLING_FORBIDDEN', 'settings.billing.failure.forbidden'],
    ['BILLING_PROVIDER_REFUSED', 'settings.billing.failure.providerRefused'],
    ['BILLING_RATE_LIMITED', 'settings.billing.failure.rateLimited'],
    ['BILLING_NOT_CONNECTED', 'settings.billing.failure.notConnected'],
    [
      'BILLING_ORDER_NOT_INVOICEABLE',
      'settings.billing.failure.orderNotInvoiceable',
    ],
  ] as const)('says the %s sentence and quotes the reference', (code, key) => {
    const failure = readBillingFailure(
      t,
      arrived({ kind: 'unexpected', code, reference: REFERENCE }),
    )

    expect(failure).toEqual({
      message: `${key} settings.billing.failure.reference|${REFERENCE}`,
      authored: false,
    })
  })

  it('says the generic sentence and the reference for an unexpected failure', () => {
    expect(
      readBillingFailure(
        t,
        arrived({ kind: 'unexpected', reference: REFERENCE }),
      ),
    ).toEqual({
      message: `settings.billing.provider.rejected settings.billing.failure.reference|${REFERENCE}`,
      authored: false,
    })
  })

  it('never prints the envelope, its JSON or the reference-less raw message', () => {
    for (const cause of [
      new Error(
        `planned-travel/failure/1 {"kind":"unexpected","reference":"${REFERENCE}"}`,
      ),
      new Error(
        '{"detail":"Polar PATCH /v1/subscriptions/sub_1 failed with 422"}',
      ),
      new Error('[{"origin":"string","code":"too_small"}]'),
      new Error('Polar GET /v1/orders/ord_1 failed with 500.'),
      'wrangler secret put POLAR_ACCESS_TOKEN',
      undefined,
    ]) {
      const { message, authored } = readBillingFailure(t, cause)

      expect(authored).toBe(false)
      expect(message).not.toMatch(/planned-travel|\{|\[|Polar|wrangler|\/v1\//)
      expect(message).toMatch(/^settings\.billing\.provider\.rejected/)
    }
  })

  it('shows the authored sentence of a refusal or a validation failure, marked as authored', () => {
    for (const kind of ['refusal', 'validation'] as const) {
      expect(
        readBillingFailure(
          t,
          arrived({ kind, message: 'Choose between 1 and 50 seats.' }),
        ),
      ).toEqual({ message: 'Choose between 1 and 50 seats.', authored: true })
    }
  })

  it('falls back to the generic copy for a code it does not know', () => {
    const hostile = new Error(
      `planned-travel/failure/1 ${JSON.stringify({
        kind: 'unexpected',
        code: 'BILLING_DROP_TABLE',
        reference: REFERENCE,
      })}`,
    )

    expect(readBillingFailure(t, hostile).message).toBe(
      `settings.billing.provider.rejected settings.billing.failure.reference|${REFERENCE}`,
    )
  })

  it('does not let a quota code, which is not a billing sentence, pick its own copy', () => {
    expect(
      readBillingFailure(
        t,
        arrived({ kind: 'unexpected', code: 'QUOTA_EXCEEDED' }),
      ).message,
    ).toBe('settings.billing.provider.rejected')
  })
})
