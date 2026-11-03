import { expect, it } from 'vitest'
import { converterAmount, converterResult } from '../currency-conversion'

it.each([
  ['JPY', '999999999.5', '1000000000', '1000000000.1', 1000000000],
  ['EUR', '999999999.999', '1000000000.00', '1000000000.0001', 100000000000],
  ['KWD', '999999999.9999', '1000000000.000', '1000000000.0001', 1000000000000],
] as const)(
  'accepts source rounding up to the %s ceiling without accepting a larger input',
  (currency, below, exact, above, maximum) => {
    expect(converterAmount(below, currency, 'en')).toBe(maximum)
    expect(converterAmount(exact, currency, 'en')).toBe(maximum)
    expect(converterAmount(above, currency, 'en')).toBeNull()
  },
)

it('keeps the money boundaries and major-per-EUR direction', () => {
  const rates = { EUR: 1, USD: 1.25, JPY: 150 }
  expect(converterResult(10000, 'EUR', 'USD', rates)?.minor).toBe(12500)
  expect(converterResult(10000, 'USD', 'EUR', rates)?.minor).toBe(8000)
  expect(converterResult(10000, 'USD', 'JPY', rates)?.minor).toBe(12000)
  expect(converterResult(1, 'EUR', 'USD', { EUR: 1, USD: 1.5 })?.minor).toBe(2)
  expect(converterResult(0, 'EUR', 'USD', rates)?.minor).toBe(0)
  expect(converterResult(123, 'KWD', 'KWD', {})?.minor).toBe(123)
  expect(converterAmount('1.005', 'EUR', 'en')).toBe(101)
  expect(converterAmount('1.234', 'KWD', 'en')).toBe(1234)
  for (const text of [
    '',
    '-1',
    '1e3',
    'Infinity',
    '1000000001',
    '1000000000.0001',
    'USD 1',
    'abc1',
    '1'.repeat(65),
  ])
    expect(converterAmount(text, 'EUR', 'en')).toBeNull()
  expect(
    converterResult(Number.MAX_SAFE_INTEGER, 'EUR', 'USD', {
      EUR: 1,
      USD: 100,
    }),
  ).toBeNull()
})
