import { describe, expect, it } from 'vitest'

import { encodePublicFailure } from '../errors'
import { TRANSPORT_REFUSAL_KEYS, transportRefusalOf } from '../transport-refusals'

describe('transportRefusalOf', () => {
  it('reads the key out of the redaction envelope a server function failure arrives in', () => {
    for (const key of TRANSPORT_REFUSAL_KEYS) {
      const cause = new Error(
        encodePublicFailure({ kind: 'refusal', message: key }),
      )
      expect(transportRefusalOf(cause)).toBe(key)
    }
  })

  it('reads the key from a raw message, for a refusal thrown on the client itself', () => {
    expect(
      transportRefusalOf(new Error('modules.transports.refusal.gone')),
    ).toBe('modules.transports.refusal.gone')
    expect(transportRefusalOf('modules.transports.refusal.gone')).toBe(
      'modules.transports.refusal.gone',
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
      new Error('oops modules.transports.refusal.gone'),
    ],
    [
      'a currency refusal key',
      new Error('shell.editTrip.currencyLocked'),
    ],
    [
      'something that is not an error',
      { message: 'modules.transports.refusal.gone' },
    ],
    ['nothing', undefined],
  ])('answers null for %s', (_name, cause) => {
    expect(transportRefusalOf(cause)).toBeNull()
  })
})
