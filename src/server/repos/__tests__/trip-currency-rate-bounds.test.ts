import { describe, expect, it } from 'vitest'

import { MAX_EXCHANGE_RATE, MIN_EXCHANGE_RATE } from '#/lib/money'
import { MAX_REBASE_RATE, MIN_REBASE_RATE } from '../trip-currency'

/**
 * The budget currency dialog validates the rate before it asks the server, with the bounds in
 * `#/lib/money`; the server's schema holds its own. A rate the dialog accepts and the server refuses
 * would surface as a preview failure the traveller cannot fix, so the two pairs are one pair.
 */
describe('the rate bounds of a budget currency change', () => {
  it('are the same on the client and on the server', () => {
    expect(MIN_EXCHANGE_RATE).toBe(MIN_REBASE_RATE)
    expect(MAX_EXCHANGE_RATE).toBe(MAX_REBASE_RATE)
  })
})
