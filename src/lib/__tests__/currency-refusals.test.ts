import { describe, expect, it } from 'vitest'

import { CURRENCY_REFUSAL_KEYS, currencyRefusalOf } from '../currency-refusals'
import { encodePublicFailure } from '../errors'

describe('currencyRefusalOf', () => {
  it('reads the key out of the redaction envelope a server function failure arrives in', () => {
    for (const key of CURRENCY_REFUSAL_KEYS) {
      const cause = new Error(
        encodePublicFailure({ kind: 'refusal', message: key }),
      )
      expect(currencyRefusalOf(cause)).toBe(key)
    }
  })

  it('reads the key from a raw message, for a refusal thrown on the client itself', () => {
    expect(currencyRefusalOf(new Error('shell.editTrip.currencyLocked'))).toBe(
      'shell.editTrip.currencyLocked',
    )
    expect(currencyRefusalOf('shell.editTrip.currencyLocked')).toBe(
      'shell.editTrip.currencyLocked',
    )
  })

  it.each([
    [
      'another refusal',
      new Error(
        encodePublicFailure({
          kind: 'refusal',
          message: 'This trip is archived.',
        }),
      ),
    ],
    [
      'a diagnostic',
      new Error(encodePublicFailure({ kind: 'unexpected', reference: 'r1' })),
    ],
    [
      'a message that only contains the key',
      new Error('oops shell.editTrip.currencyLocked'),
    ],
    [
      'something that is not an error',
      { message: 'shell.editTrip.currencyLocked' },
    ],
    ['nothing', undefined],
  ])('answers null for %s', (_name, cause) => {
    expect(currencyRefusalOf(cause)).toBeNull()
  })
})
