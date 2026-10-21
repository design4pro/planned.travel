/**
 * Which currencies a trip can be budgeted in, in what order, and what a search matches.
 *
 * **Codes and logic only - never a name.** The nine favourites are the product's choice; the words
 * beside them come from the currency-name module (`routes/_app/-lib/currency-names.ts`), and
 * the caller hands each option's name in when it searches. Writing a name here once put a second
 * English copy of nine currencies beside that set.
 */

/** The currencies a trip is most often budgeted in, in the order they lead the list. */
export const FAVOURITE_CURRENCIES: ReadonlyArray<string> = [
  'EUR',
  'GBP',
  'USD',
  'CHF',
  'PLN',
  'SEK',
  'JPY',
  'AUD',
  'CAD',
]

/**
 * The runtime's own currency set, or nothing when the platform cannot say.
 *
 * `Intl.supportedValuesOf` is missing from older engines and throws on some others; either way the
 * list degrades to the favourites rather than to an error.
 */
export function platformCurrencyCodes(): ReadonlyArray<string> {
  try {
    return Intl.supportedValuesOf('currency')
  } catch {
    return []
  }
}

/**
 * The favourites first and once, then every other code of `runtime` in code order.
 *
 * `include` keeps a stored code selectable when neither list knows it (a workspace default the
 * platform dropped), so the control never shows a value it cannot offer.
 */
export function mergeCurrencies(
  runtime: ReadonlyArray<string>,
  include?: string,
): ReadonlyArray<string> {
  const seen = new Set(FAVOURITE_CURRENCIES)
  const rest = [...runtime, ...(include === undefined ? [] : [include])]
    .map((code) => code.toUpperCase())
    .filter((code) => {
      if (seen.has(code)) return false
      seen.add(code)
      return true
    })
    .sort()
  return [...FAVOURITE_CURRENCIES, ...rest]
}

/** Whether a search matches a currency on its code or on its name, ignoring case. */
export function currencyMatches(
  code: string,
  name: string,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  return (
    code.toLowerCase().includes(needle) || name.toLowerCase().includes(needle)
  )
}
