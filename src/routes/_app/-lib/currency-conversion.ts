import {
  convertMinor,
  parseMoney,
  minorUnitDigits,
  MIN_EXCHANGE_RATE,
  MAX_EXCHANGE_RATE,
  toAsciiDigits,
} from '#/lib/money'
import { mergeCurrencies, platformCurrencyCodes } from '#/lib/currency-list'
import type { Locale } from '#/lib/i18n'

export function converterAmount(
  text: string,
  currency: string,
  locale: Locale,
): number | null {
  if (text.length > 64 || /[eE]/.test(text)) return null
  if (!/^[\d\s.,'\u2019]+$/.test(toAsciiDigits(text))) return null
  const amount = parseMoney(toAsciiDigits(text), currency, locale)
  // Reject over-limit fractions even when source rounding lands back on the ceiling.
  const maximum = 1_000_000_000 * 10 ** minorUnitDigits(currency)
  if (
    amount === maximum &&
    toAsciiDigits(text)
      .replace(/\D/g, '')
      .replace(/^0+|0+$/g, '') !== '1'
  )
    return null
  return amount !== null &&
    amount <= 1_000_000_000 * 10 ** minorUnitDigits(currency)
    ? amount
    : null
}

export function converterResult(
  amount: number,
  from: string,
  to: string,
  rates: Readonly<Record<string, number | undefined>>,
): { minor: number; rate: number } | null {
  if (from === to) {
    if (!mergeCurrencies(platformCurrencyCodes()).includes(from)) return null
    return { minor: amount, rate: 1 }
  }
  const source = rates[from]
  const target = rates[to]
  if (!source || !target) return null
  const rate = target / source
  if (
    !Number.isFinite(rate) ||
    rate < MIN_EXCHANGE_RATE ||
    rate > MAX_EXCHANGE_RATE
  )
    return null
  try {
    return { minor: convertMinor(amount, rate, from, to), rate }
  } catch {
    return null
  }
}
