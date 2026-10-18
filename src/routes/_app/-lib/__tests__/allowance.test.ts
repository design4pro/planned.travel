import { describe, expect, it } from 'vitest'

import { parseAllowanceDays } from '../allowance'

describe('parseAllowanceDays', () => {
  it.each([
    ['0', 0],
    ['25', 25],
    [' 365 ', 365],
    ['007', 7],
  ])('reads %j as %d days', (text, days) => {
    expect(parseAllowanceDays(text)).toBe(days)
  })

  it.each([
    ['٢٥', 25],
    ['۲۵', 25],
    ['２５', 25],
  ])('reads the digits of %j as ASCII', (text, days) => {
    expect(parseAllowanceDays(text)).toBe(days)
  })

  it.each([
    '',
    ' ',
    '366',
    '1000',
    '-1',
    '+5',
    '12.5',
    '12,5',
    '١٢٫٥',
    '2e1',
    '25 days',
  ])('refuses %j', (text) => {
    expect(parseAllowanceDays(text)).toBeNull()
  })
})
