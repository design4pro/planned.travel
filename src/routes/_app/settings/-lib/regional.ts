/**
 * The option lists the two regional forms share, and the copy that names them.
 *
 * `/settings` writes the traveller's overrides and `/settings/organization`
 * writes the workspace defaults, from the same six fields. They used to carry
 * two divergent copies of every list — including two contradictory `LOCALES`
 * consts, eight region-tagged values against five, both labelled in English and
 * both writing the same column. One list, here, is what stops that happening
 * again.
 *
 * **Nothing in here is a translated identifier.** An ISO 4217 code and an IANA
 * zone id read the same in every language, and `src/lib/i18n/__tests__/parity`
 * treats a translation byte-identical to English as untranslated copy
 * (`docs/SPEC.md` §8.6). So the code is printed as the code, the zone's label is
 * derived from its own city segment, and only the words around them —
 * "Australian dollar", "Kilometres" — come from the catalogue.
 *
 * **The date sample is composed, never a literal.** `dd MMM yyyy` has to show a
 * month name, and a hard-coded `23 Jun 2026` would put the English abbreviation
 * on a Japanese screen. `monthName` reads the frozen CLDR table in
 * `src/lib/format-tables.ts` — frozen because workerd answers `Sept` where
 * WebKit answers `Sep`, which §8.5 calls a defect rather than a tolerance — so
 * the sample is in the reader's own language and identical on both sides of
 * hydration. The three numeric patterns are digits and separators only, so they
 * need no words at all.
 *
 * The language field is deliberately absent: `docs/SPEC.md` §8.7 gives it its
 * own screen at `/settings/language`, where twenty-three native names fit.
 */

import { monthName, weekdayName } from '#/lib/format'
import type { Locale, Translate } from '#/lib/i18n'

/** One `SimpleSelect` option, in the shape the primitive takes. */
export interface RegionalOption {
  value: string
  label: string
}

/** The currencies a trip can be budgeted in, in code order. */
export const CURRENCY_CODES: ReadonlyArray<string> = [
  'AUD',
  'CAD',
  'CHF',
  'EUR',
  'GBP',
  'JPY',
  'PLN',
  'SEK',
  'USD',
]

/** The zones on offer, widest coverage first, then west to east. */
export const TIME_ZONES: ReadonlyArray<string> = [
  'UTC',
  'America/Los_Angeles',
  'America/Chicago',
  'America/New_York',
  'Europe/Dublin',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Warsaw',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
]

/** The stored date patterns, in the order they are offered. */
export const DATE_PATTERNS: ReadonlyArray<string> = [
  'dd MMM yyyy',
  'dd/MM/yyyy',
  'MM/dd/yyyy',
  'yyyy-MM-dd',
]

/** `getUTCDay()` indices, so the value stored is the index itself. */
export const WEEK_START_DAYS: ReadonlyArray<number> = [1, 0, 6]

export const DISTANCE_UNITS: ReadonlyArray<'metric' | 'imperial'> = [
  'metric',
  'imperial',
]

/**
 * A currency's name, or the bare code for one a workspace stored before this
 * list existed. The code is always shown beside it, so an unnamed code still
 * identifies itself rather than rendering an empty option.
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
 *
 * The catalogue names nine codes, and a name for the other ~300 cannot be written here without a
 * second English copy, so the rest come from `Intl.DisplayNames`. That API disagrees between
 * workerd and WebKit (`src/lib/i18n/__tests__/source-rules.test.ts` says why), so this is **only for
 * markup a reader opens**: the trip form's currency list renders after a click, never in the server
 * pass, so there is no second render to disagree with. Never call it from a page's first paint.
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

/**
 * `currencyLabel` for markup a reader opens: the catalogue's name where it has one, the platform's
 * where it does not. See {@link platformCurrencyName} for why this is not `currencyLabel` itself.
 */
export function openedCurrencyLabel(
  t: Translate,
  locale: Locale,
  code: string,
): string {
  const named = currencyName(t, code)
  const name = named === code ? platformCurrencyName(locale, code) : named
  return name === code ? code : `${code} — ${name}`
}

/** `GBP` → `GBP — Pound sterling`; an unknown code stays just the code. */
export function currencyLabel(t: Translate, code: string): string {
  const name = currencyName(t, code)
  return name === code ? code : `${code} — ${name}`
}

/**
 * `Europe/London` → `London`, `UTC` → `UTC`.
 *
 * The tz database's own city segment, not a translated exonym: the same reason
 * the ISO code is not translated, and the reason this needs no catalogue key.
 */
export function timeZoneLabel(zone: string): string {
  const segments = zone.split('/')
  return segments[segments.length - 1].replace(/_/g, ' ')
}

export function distanceLabel(
  t: Translate,
  unit: 'metric' | 'imperial',
): string {
  return unit === 'imperial'
    ? t('settings.regional.distance.imperial')
    : t('settings.regional.distance.metric')
}

/** The illustrative day every pattern is shown with: 23 June 2026. */
const SAMPLE_MONTH = 5
const SAMPLE_DAY = '23'
const SAMPLE_YEAR = '2026'

/** What a stored pattern looks like once written out in this locale. */
export function dateFormatLabel(pattern: string, locale: Locale): string {
  switch (pattern) {
    case 'dd/MM/yyyy':
      return `${SAMPLE_DAY}/06/${SAMPLE_YEAR}`
    case 'MM/dd/yyyy':
      return `06/${SAMPLE_DAY}/${SAMPLE_YEAR}`
    case 'yyyy-MM-dd':
      return `${SAMPLE_YEAR}-06-${SAMPLE_DAY}`
    case 'dd MMM yyyy':
      return `${SAMPLE_DAY} ${monthName(SAMPLE_MONTH, locale) ?? ''} ${SAMPLE_YEAR}`.trim()
    default:
      return pattern
  }
}

/** A week-start index as this locale's own weekday name. */
export function weekStartLabel(day: number, locale: Locale): string {
  return weekdayName(day, locale, 'long') ?? String(day)
}

/** The three membership roles; anything else falls back to `member`. */
export function roleLabel(t: Translate, role: string | null): string {
  switch (role) {
    case 'owner':
      return t('settings.role.owner')
    case 'admin':
      return t('settings.role.admin')
    default:
      return t('settings.role.member')
  }
}

/* ----------------------------------------------------------------- builders */

export function currencyOptions(
  t: Translate,
  stored: string,
): Array<RegionalOption> {
  return withStored(
    CURRENCY_CODES.map((code) => ({
      value: code,
      label: currencyLabel(t, code),
    })),
    stored,
    (value) => currencyLabel(t, value),
  )
}

export function timeZoneOptions(stored: string): Array<RegionalOption> {
  return withStored(
    TIME_ZONES.map((zone) => ({ value: zone, label: timeZoneLabel(zone) })),
    stored,
    timeZoneLabel,
  )
}

export function dateFormatOptions(
  locale: Locale,
  stored: string,
): Array<RegionalOption> {
  return withStored(
    DATE_PATTERNS.map((pattern) => ({
      value: pattern,
      label: dateFormatLabel(pattern, locale),
    })),
    stored,
    (value) => dateFormatLabel(value, locale),
  )
}

export function weekStartOptions(
  locale: Locale,
  stored: string,
): Array<RegionalOption> {
  return withStored(
    WEEK_START_DAYS.map((day) => ({
      value: String(day),
      label: weekStartLabel(day, locale),
    })),
    stored,
    (value) => weekStartLabel(Number.parseInt(value, 10), locale),
  )
}

export function distanceOptions(t: Translate): Array<RegionalOption> {
  return DISTANCE_UNITS.map((unit) => ({
    value: unit,
    label: distanceLabel(t, unit),
  }))
}

/**
 * Keeps whatever is actually stored selectable.
 *
 * A workspace can hold a zone, a currency or a pattern this list no longer
 * offers, and `SimpleSelect` derives its trigger text from the option carrying
 * the current value — so an unlisted value used to render a blank control that
 * silently rewrote itself on the next save. Prepending the stored value, named
 * by the same function that names the rest, means the trigger always says what
 * D1 holds.
 */
function withStored(
  options: Array<RegionalOption>,
  stored: string,
  name: (value: string) => string,
): Array<RegionalOption> {
  if (stored === '' || options.some((option) => option.value === stored)) {
    return options
  }
  return [{ value: stored, label: name(stored) }, ...options]
}

/** The follow-the-workspace option that heads every personal override. */
export const FOLLOW_DEFAULT = 'default'

/**
 * Prepends "Workspace default — <value>" to a personal override's list.
 *
 * The workspace's own value is named with the same function that names the
 * options below it, so the two never disagree about what `Europe/Warsaw` is
 * called.
 */
export function withWorkspaceDefault(
  t: Translate,
  options: Array<RegionalOption>,
  workspaceValue: string,
): Array<RegionalOption> {
  return [
    {
      value: FOLLOW_DEFAULT,
      label: t('settings.regional.workspaceDefault', { value: workspaceValue }),
    },
    ...options,
  ]
}
