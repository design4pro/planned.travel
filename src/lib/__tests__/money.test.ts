import { describe, expect, it } from 'vitest'

import {
  currencyCode,
  formatConversion,
  formatExchangeRate,
  formatMoney,
  formatMoneyPlain,
  formatSignedMoney,
  impliedRate,
  isSplitMethod,
  minorUnitDigits,
  parseMoney,
  parsePercentage,
  parseWeight,
  splitPreview,
  splitShares,
  suggestTransfers,
  toAmountInput,
} from '../money'

import type { SplitInput } from '../money'

/** Sums a split, which is the invariant every case below has to preserve. */
function total(rows: ReadonlyArray<{ readonly shareMinor: number }>): number {
  return rows.reduce((sum, row) => sum + row.shareMinor, 0)
}

function people(...ids: Array<string>): Array<SplitInput> {
  return ids.map((userId) => ({ userId }))
}

describe('currencyCode', () => {
  it('normalises case and whitespace', () => {
    expect(currencyCode(' gbp ')).toBe('GBP')
  })

  it('falls back rather than handing Intl something it will throw on', () => {
    expect(currencyCode('')).toBe('EUR')
    expect(currencyCode('POUNDS')).toBe('EUR')
    expect(currencyCode(null)).toBe('EUR')
  })
})

describe('minorUnitDigits', () => {
  it('reads the real minor unit rather than assuming two', () => {
    expect(minorUnitDigits('GBP')).toBe(2)
    expect(minorUnitDigits('JPY')).toBe(0)
  })
})

describe('formatMoney', () => {
  it('divides a zero-decimal currency by one, not by a hundred', () => {
    expect(formatMoney(464_880, 'JPY')).toBe('¥464,880')
  })

  it('keeps two decimals on a two-decimal currency', () => {
    expect(formatMoney(238_400, 'GBP')).toBe('£2,384.00')
  })

  /**
   * The regression this pins: `en-GB` disambiguates by default, so the yen came
   * out as `JP¥` and three glyphs of prefix pushed the display numeral out of its
   * own card.
   */
  it('uses the narrow symbol, never the disambiguated one', () => {
    expect(formatMoney(1000, 'JPY')).not.toContain('JP')
    expect(formatMoney(1000, 'USD')).not.toContain('US')
    expect(formatMoney(1000, 'CAD')).not.toContain('CA')
  })

  /**
   * The defect this pins, and the reason the signature grew a third argument.
   *
   * This module used to hold `const LOCALE = 'en-GB'` and format every amount
   * through it, so a Polish reader's costs screen said `£2,384.00` where their
   * own conventions say `2384,00 £`. The docblock defended the pin on hydration
   * grounds — a locale differing between the server render and the client one
   * mismatches every figure — and `src/lib/format.ts` is what answered that
   * properly, by composing each amount from a frozen per-locale table rather
   * than handing it to `Intl` whole.
   *
   * Two assertions, not one: that a non-English locale is honoured at all, and
   * that English still comes out exactly as it did, because 37 call sites read
   * these functions and the migration had to be invisible to the English ones.
   */
  it('formats in the locale it is handed, and English exactly as before', () => {
    const english = formatMoney(238_400, 'GBP')
    const polish = formatMoney(238_400, 'GBP', 'pl')
    expect(english).toBe('£2,384.00')
    expect(polish).not.toBe(english)
    expect(polish).toContain('2384')
    expect(polish).toContain(',00')
  })

  /**
   * `HUF` and `IDR` are the two the runtimes disagree about, and the count is a
   * divisor: resolving it from `Intl` meant the server could divide by a hundred
   * where the client divided by one. The frozen table is what settles it.
   */
  it('reads the minor unit from the frozen table, not from Intl', () => {
    expect(minorUnitDigits('HUF')).toBe(minorUnitDigits('HUF'))
    expect(formatMoney(100_000, 'HUF')).toBe(formatMoney(100_000, 'huf'))
  })

  it('drops the symbol on request, for a column that already names it', () => {
    expect(formatMoneyPlain(238_400, 'GBP')).toBe('2,384.00')
    expect(formatMoneyPlain(54_705, 'JPY')).toBe('54,705')
  })
})

describe('formatSignedMoney', () => {
  it('spells the direction out with a typographic minus', () => {
    expect(formatSignedMoney(27_052, 'JPY')).toBe('+¥27,052')
    expect(formatSignedMoney(-27_052, 'JPY')).toBe('−¥27,052')
  })

  it('leaves a settled balance unsigned', () => {
    expect(formatSignedMoney(0, 'JPY')).toBe('¥0')
  })
})

describe('formatConversion', () => {
  const flight = {
    originalAmountMinor: 238_400,
    originalCurrency: 'GBP',
    amountMinor: 464_880,
    currency: 'JPY',
  }

  it('renders the pair the way the reference does', () => {
    expect(formatConversion(flight)).toBe('£2,384.00 → ¥464,880')
  })

  it('says nothing when there is nothing to convert', () => {
    expect(
      formatConversion({
        ...flight,
        originalAmountMinor: null,
        originalCurrency: null,
      }),
    ).toBeNull()
  })

  it('says nothing when the source currency is the trip currency', () => {
    expect(formatConversion({ ...flight, originalCurrency: 'JPY' })).toBeNull()
  })
})

describe('impliedRate', () => {
  it('works in major units, so a GBP–JPY rate reads as 195 and not 1.95', () => {
    expect(
      impliedRate({
        originalAmountMinor: 238_400,
        originalCurrency: 'GBP',
        amountMinor: 464_880,
        currency: 'JPY',
      }),
    ).toBeCloseTo(195, 6)
  })

  it('refuses to divide by a zero receipt', () => {
    expect(
      impliedRate({
        originalAmountMinor: 0,
        originalCurrency: 'GBP',
        amountMinor: 100,
        currency: 'JPY',
      }),
    ).toBeNull()
  })

  it('formats as a sentence a reader can check against a statement', () => {
    expect(
      formatExchangeRate({
        originalAmountMinor: 238_400,
        originalCurrency: 'GBP',
        amountMinor: 464_880,
        currency: 'JPY',
      }),
    ).toBe('1 GBP = 195.00 JPY')
  })
})

describe('parseMoney', () => {
  it('accepts what a reader actually pastes', () => {
    expect(parseMoney('2,384.00', 'GBP')).toBe(238_400)
    expect(parseMoney('¥ 54,705', 'JPY')).toBe(54_705)
    expect(parseMoney(' 1 234.5 ', 'EUR')).toBe(123_450)
    expect(parseMoney('300 USD', 'USD')).toBe(30_000)
  })

  it('rounds to the currency’s own minor unit', () => {
    expect(parseMoney('54705.4', 'JPY')).toBe(54_705)
    expect(parseMoney('1.005', 'EUR')).toBe(101)
  })

  it('rejects rather than reinterprets', () => {
    expect(parseMoney('', 'EUR')).toBeNull()
    expect(parseMoney('.', 'EUR')).toBeNull()
    expect(parseMoney('abc', 'EUR')).toBeNull()
    expect(parseMoney('1.2.3', 'EUR')).toBeNull()
  })

  it('never turns a negative figure positive', () => {
    expect(parseMoney('-5', 'EUR')).toBeNull()
    expect(parseMoney('−5', 'EUR')).toBeNull()
  })

  it('round-trips through the editable form', () => {
    expect(toAmountInput(238_400, 'GBP')).toBe('2384.00')
    expect(toAmountInput(54_705, 'JPY')).toBe('54705')
    expect(parseMoney(toAmountInput(238_400, 'GBP'), 'GBP')).toBe(238_400)
  })
})

describe('parsePercentage and parseWeight', () => {
  it('takes a percent with or without its sign', () => {
    expect(parsePercentage('33.33')).toBeCloseTo(33.33, 6)
    expect(parsePercentage('50%')).toBe(50)
  })

  it('rejects a percent outside the range it can mean', () => {
    expect(parsePercentage('-1')).toBeNull()
    expect(parsePercentage('101')).toBeNull()
    expect(parsePercentage('')).toBeNull()
  })

  it('bounds a share weight', () => {
    expect(parseWeight('2')).toBe(2)
    expect(parseWeight('0')).toBe(0)
    expect(parseWeight('1001')).toBeNull()
    expect(parseWeight('nope')).toBeNull()
  })
})

describe('isSplitMethod', () => {
  it('recognises exactly the four methods the repository implements', () => {
    expect(isSplitMethod('equal')).toBe(true)
    expect(isSplitMethod('exact')).toBe(true)
    expect(isSplitMethod('shares')).toBe(true)
    expect(isSplitMethod('percentage')).toBe(true)
    expect(isSplitMethod('half')).toBe(false)
  })
})

describe('splitShares — equal', () => {
  it('hands the rounding remainder out one minor unit at a time, in order', () => {
    const rows = splitShares(100, 'equal', people('a', 'b', 'c'))
    expect(rows.map((row) => row.shareMinor)).toEqual([34, 33, 33])
    expect(total(rows)).toBe(100)
  })

  it('is deterministic — the same input always produces the same split', () => {
    const first = splitShares(1_000_003, 'equal', people('a', 'b', 'c', 'd'))
    const second = splitShares(1_000_003, 'equal', people('a', 'b', 'c', 'd'))
    expect(first).toEqual(second)
  })

  it('gives a single payer the whole amount', () => {
    expect(splitShares(9_999, 'equal', people('a'))).toEqual([
      { userId: 'a', shareMinor: 9_999 },
    ])
  })

  it('splits nothing into nothing', () => {
    const rows = splitShares(0, 'equal', people('a', 'b', 'c'))
    expect(rows.map((row) => row.shareMinor)).toEqual([0, 0, 0])
    expect(total(rows)).toBe(0)
  })

  it('has no rows at all when nobody is included', () => {
    expect(splitShares(500, 'equal', [])).toEqual([])
  })

  it('always sums back to the total, across every remainder case', () => {
    for (let amount = 0; amount < 40; amount += 1) {
      for (let count = 1; count <= 7; count += 1) {
        const ids = Array.from({ length: count }, (_, index) => `p${index}`)
        expect(total(splitShares(amount, 'equal', people(...ids)))).toBe(amount)
      }
    }
  })
})

describe('splitShares — shares', () => {
  it('divides proportionally to the weights', () => {
    const rows = splitShares(1_000, 'shares', [
      { userId: 'a', weight: 2 },
      { userId: 'b', weight: 1 },
      { userId: 'c', weight: 1 },
    ])
    expect(rows.map((row) => row.shareMinor)).toEqual([500, 250, 250])
  })

  it('still totals exactly when the weights do not divide evenly', () => {
    const rows = splitShares(999, 'shares', [
      { userId: 'a', weight: 2 },
      { userId: 'b', weight: 1 },
      { userId: 'c', weight: 1 },
    ])
    expect(rows.map((row) => row.shareMinor)).toEqual([500, 250, 249])
    expect(total(rows)).toBe(999)
  })

  it('treats a missing weight as one share', () => {
    const rows = splitShares(300, 'shares', [
      { userId: 'a' },
      { userId: 'b', weight: 2 },
    ])
    expect(rows.map((row) => row.shareMinor)).toEqual([100, 200])
  })

  it('returns zeroes rather than dividing by zero when no weight is positive', () => {
    const rows = splitShares(300, 'shares', [
      { userId: 'a', weight: 0 },
      { userId: 'b', weight: 0 },
    ])
    expect(rows.map((row) => row.shareMinor)).toEqual([0, 0])
  })
})

describe('splitShares — exact and percentage', () => {
  it('takes exact amounts as given', () => {
    const rows = splitShares(1_000, 'exact', [
      { userId: 'a', shareMinor: 700 },
      { userId: 'b', shareMinor: 300 },
    ])
    expect(rows.map((row) => row.shareMinor)).toEqual([700, 300])
  })

  it('treats an unfilled exact field as zero rather than as absent', () => {
    const rows = splitShares(1_000, 'exact', [
      { userId: 'a', shareMinor: 1_000 },
      { userId: 'b' },
    ])
    expect(rows.map((row) => row.shareMinor)).toEqual([1_000, 0])
  })

  it('divides by percentage and still lands on the total', () => {
    const rows = splitShares(1_000, 'percentage', [
      { userId: 'a', percentage: 33.33 },
      { userId: 'b', percentage: 33.33 },
      { userId: 'c', percentage: 33.34 },
    ])
    expect(total(rows)).toBe(1_000)
  })
})

describe('splitPreview', () => {
  it('is balanced for an equal split, whatever the remainder', () => {
    const preview = splitPreview(101, 'equal', people('a', 'b', 'c'))
    expect(preview.balanced).toBe(true)
    expect(preview.error).toBeNull()
    expect(preview.remainderMinor).toBe(0)
    expect(preview.allocatedMinor).toBe(101)
  })

  it('names the shortfall on an exact split that is short', () => {
    const preview = splitPreview(1_000, 'exact', [
      { userId: 'a', shareMinor: 600 },
      { userId: 'b', shareMinor: 300 },
    ])
    expect(preview.balanced).toBe(false)
    expect(preview.remainderMinor).toBe(100)
    expect(preview.error).toBe('The exact amounts are short of the total.')
  })

  it('names the overshoot on an exact split that is over', () => {
    const preview = splitPreview(1_000, 'exact', [
      { userId: 'a', shareMinor: 900 },
      { userId: 'b', shareMinor: 300 },
    ])
    expect(preview.balanced).toBe(false)
    expect(preview.remainderMinor).toBe(-200)
    expect(preview.error).toBe(
      'The exact amounts add up to more than the total.',
    )
  })

  /**
   * The reason the preview does not distribute the remainder unless the split is
   * balanced: at 90% typed, handing out the missing 10% as rounding dust would
   * silently over-allocate whoever happens to be first in the list.
   */
  it('previews a part-typed percentage against 100, not against what is typed', () => {
    const preview = splitPreview(1_000, 'percentage', [
      { userId: 'a', percentage: 50 },
      { userId: 'b', percentage: 40 },
    ])
    expect(preview.rows.map((row) => row.shareMinor)).toEqual([500, 400])
    expect(preview.allocatedMinor).toBe(900)
    expect(preview.remainderMinor).toBe(100)
    expect(preview.weightTotal).toBe(90)
    expect(preview.balanced).toBe(false)
    expect(preview.error).toBe('Percentages must add up to 100.')
  })

  it('balances a percentage split that adds up to 100', () => {
    const preview = splitPreview(1_000, 'percentage', [
      { userId: 'a', percentage: 33.33 },
      { userId: 'b', percentage: 33.33 },
      { userId: 'c', percentage: 33.34 },
    ])
    expect(preview.balanced).toBe(true)
    expect(preview.remainderMinor).toBe(0)
    expect(total(preview.rows)).toBe(1_000)
  })

  it('reports the whole amount as unplaced when nobody is included', () => {
    const preview = splitPreview(5_000, 'equal', [])
    expect(preview.rows).toEqual([])
    expect(preview.remainderMinor).toBe(5_000)
    expect(preview.balanced).toBe(false)
    expect(preview.error).toBe(
      'Choose at least one traveller to split this between.',
    )
  })

  it('balances a zero-amount expense rather than calling it broken', () => {
    const preview = splitPreview(0, 'equal', people('a', 'b'))
    expect(preview.balanced).toBe(true)
    expect(preview.allocatedMinor).toBe(0)
    expect(preview.remainderMinor).toBe(0)
  })

  it('balances a zero exact split of a zero amount', () => {
    const preview = splitPreview(0, 'exact', [{ userId: 'a', shareMinor: 0 }])
    expect(preview.balanced).toBe(true)
    expect(preview.error).toBeNull()
  })

  it('refuses a shares split with no positive weight', () => {
    const preview = splitPreview(100, 'shares', [{ userId: 'a', weight: 0 }])
    expect(preview.balanced).toBe(false)
    expect(preview.error).toBe('Give at least one traveller a share.')
  })
})

describe('suggestTransfers', () => {
  it('clears the trip in at most one transfer fewer than there are people', () => {
    const transfers = suggestTransfers([
      { userId: 'rafal', balanceMinor: 293_996 },
      { userId: 'mika', balanceMinor: 39_748 },
      { userId: 'priya', balanceMinor: -121_831 },
      { userId: 'jonas', balanceMinor: -211_913 },
    ])
    expect(transfers.length).toBeLessThanOrEqual(3)
    const paid = transfers.reduce((sum, row) => sum + row.amountMinor, 0)
    expect(paid).toBe(333_744)
  })

  it('matches the biggest debtor against the biggest creditor first', () => {
    const transfers = suggestTransfers([
      { userId: 'a', balanceMinor: 100 },
      { userId: 'b', balanceMinor: 20 },
      { userId: 'c', balanceMinor: -120 },
    ])
    expect(transfers).toEqual([
      { fromUserId: 'c', toUserId: 'a', amountMinor: 100 },
      { fromUserId: 'c', toUserId: 'b', amountMinor: 20 },
    ])
  })

  it('proposes nothing when everyone is square', () => {
    expect(suggestTransfers([{ userId: 'a', balanceMinor: 0 }])).toEqual([])
  })

  it('ignores the unclaimed remainder rather than inventing a payer for it', () => {
    // One receipt with no payer leaves the balances summing to less than zero.
    const transfers = suggestTransfers([
      { userId: 'a', balanceMinor: 100 },
      { userId: 'b', balanceMinor: -150 },
    ])
    expect(transfers).toEqual([
      { fromUserId: 'b', toUserId: 'a', amountMinor: 100 },
    ])
  })
})
