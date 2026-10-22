/**
 * A currency's name in the reader's language, for every picker that offers one.
 *
 * The catalogue names nine codes (`settings.regional.currency.*`), and the pickers offer more, so a
 * name for the rest cannot be written here without a second English copy. Those come from
 * `Intl.DisplayNames`, which disagrees between workerd and WebKit
 * (`src/lib/i18n/__tests__/source-rules.test.ts` says why). That is why this module is not under
 * `src/lib/`, where the source rules ban the API, and why {@link openedCurrencyLabel} and
 * {@link openedCurrencyOptions} are **only for markup a reader opens**: the trip form's and the
 * costs dialogs' currency lists render after a click, never in the server pass, so there is no
 * second render to disagree with. Never call them from a page's first paint.
 */

import type { Locale, Translate } from '#/lib/i18n'

/** One `SimpleSelect` option, in the shape the primitive takes. */
export interface CurrencyOption {
  value: string
  label: string
  description?: string
}

/**
 * A currency's name, or the bare code for one the catalogue does not name. The code is always
 * shown beside it, so an unnamed code still identifies itself rather than rendering an empty
 * option.
 */
export function currencyName(t: Translate, code: string): string {
  switch (code) {
    case 'AUD':
      return t('settings.regional.currency.AUD')
    case 'CAD':
      return t('settings.regional.currency.CAD')
    case 'CHF':
      return t('settings.regional.currency.CHF')
    case 'EUR':
      return t('settings.regional.currency.EUR')
    case 'GBP':
      return t('settings.regional.currency.GBP')
    case 'JPY':
      return t('settings.regional.currency.JPY')
    case 'PLN':
      return t('settings.regional.currency.PLN')
    case 'SEK':
      return t('settings.regional.currency.SEK')
    case 'USD':
      return t('settings.regional.currency.USD')
    default:
      return code
  }
}

const platformCurrencyNames = new Map<Locale, Intl.DisplayNames | null>()

/**
 * The currency's name as the platform writes it in this locale, or the bare code when it cannot.
 * Opened markup only; see the module comment.
 */
export function platformCurrencyName(locale: Locale, code: string): string {
  let names = platformCurrencyNames.get(locale)
  if (names === undefined) {
    try {
      names = new Intl.DisplayNames([locale], { type: 'currency' })
    } catch {
      names = null
    }
    platformCurrencyNames.set(locale, names)
  }
  try {
    return names?.of(code) ?? code
  } catch {
    return code
  }
}

/** The catalogue's name where it has one, the platform's where it does not, else the bare code. */
function openedCurrencyName(
  t: Translate,
  locale: Locale,
  code: string,
): string {
  const named = currencyName(t, code)
  return named === code ? platformCurrencyName(locale, code) : named
}

/** `GBP — Pound sterling` for markup a reader opens; an unnamed code stays just the code. */
export function openedCurrencyLabel(
  t: Translate,
  locale: Locale,
  code: string,
): string {
  const name = openedCurrencyName(t, locale, code)
  return name === code ? code : `${code} — ${name}`
}

/**
 * Picker options for `codes`: the code is the label and the reader's name its description, so an
 * option stays findable by its code and a screen reader reads the name in the reader's language.
 */
export function openedCurrencyOptions(
  t: Translate,
  locale: Locale,
  codes: ReadonlyArray<string>,
): Array<CurrencyOption> {
  return codes.map((code) => {
    const name = openedCurrencyName(t, locale, code)
    return name === code
      ? { value: code, label: code }
      : { value: code, label: code, description: name }
  })
}
