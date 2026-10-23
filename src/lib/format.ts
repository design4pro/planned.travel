/**
 * Presentation formatters shared by every screen and every product component.
 *
 * This is the one implementation. `src/routes/_app/-lib/format.ts` re-exports it
 * so the thirty route modules that already import from there keep working, and
 * nothing under `src/components` has to reach into route-private code to format
 * a date — `docs/SPEC.md` §6 puts isomorphic formatters here and calls
 * `src/routes` file-based routes only. There is exactly one date formatter in
 * the product; do not add a second one.
 *
 * ## Why every function takes a locale, and why almost nothing asks `Intl`
 *
 * The product ships in twenty-three languages (§8), so a formatter that pins one
 * locale is a formatter that renders the wrong language. Every function
 * therefore takes a trailing `locale`, defaulting to `en` — which resolves to
 * `en-GB`, the tag this module has always pinned — so every existing caller's
 * output is unchanged to the byte while a localised screen can pass its own.
 *
 * What it does *not* do is ask the platform. §8.5 makes cross-runtime agreement
 * the hardest constraint on this build, and it was learned the expensive way:
 * `Intl` resolves month abbreviations out of whichever ICU the runtime was built
 * against, workerd says `6 Sept 2024` where WebKit says `6 Sep 2024`, and every
 * server-rendered September date threw a React hydration error in Safari until
 * the abbreviations became a table. Measuring all twenty-three locales in
 * workerd, WebKit and Chromium found nine more fields with the same fault, from
 * Greek month names to Arabic list separators to the *number of minor units in a
 * Hungarian forint*. They are all frozen in `./format-tables`, which documents
 * each divergence and where its value came from.
 *
 * Three fields are still composed by `Intl` — the decimal and percent forms, the
 * narrow currency symbol, and the composed `{ month: 'long', year: 'numeric' }`
 * form — because their separators and digit widths were measured byte-identical
 * in the three runtimes across all twenty-three locales. What is *not* left to
 * the runtime is any default those calls would otherwise read out of ICU: one
 * helper builds every number formatter below and hands it the frozen row's
 * numbering system (through the `-u-nu-latn` tag) and its `useGrouping` rule,
 * because the linux WebKit the CI container ships answers `arab` for `ar` and
 * groups Italian's four digits where workerd does neither.
 * `e2e/i18n-runtime-parity.spec.ts` re-proves the whole surface on every run by
 * rendering it in WebKit and comparing it against what the Worker produced, and
 * fails the run on any difference.
 *
 * `countryName` deliberately does *not* live here. It is the one helper in the
 * old module that reached for `Intl.DisplayNames`, whose region names also differ
 * between workerd and WebKit; the atlas takes its names from the frozen table in
 * `#/lib/atlas/country-names` instead, and keeping the `Intl` version out of this
 * module keeps that dependency out of every chunk that only wants a date.
 */

/**
 * The two value imports reach past `#/lib/i18n`'s barrel on purpose, and the
 * reason is measured. The barrel re-exports `provider.tsx` and `catalogue.ts`,
 * both of which have module-level side effects — a React import and a
 * 230-module `import.meta.glob` — so no bundler may tree-shake them away. A
 * probe that imports nothing but `formatDate` emits 8.2 kB through the barrel
 * and 1.7 kB through the leaves, and the difference is React and the glob
 * landing in every chunk that only wanted to print a date.
 *
 * Nothing here grows a second locale registry: both leaves are the same frozen
 * table the barrel re-exports, and the types still come from the barrel, which
 * is what `docs/SPEC.md` §8 asks for.
 */
import { DEFAULT_LOCALE, isSupportedLocale } from '#/lib/i18n/locales'
import { plural } from '#/lib/i18n/plural'
import type { Locale } from '#/lib/i18n'

import {
  CURRENCY_MINOR_DIGITS,
  DEFAULT_MINOR_DIGITS,
  LOCALE_FORMATS,
} from './format-tables'
import type { LocaleFormats, PluralPatterns } from './format-tables'

const DAY_MS = 86_400_000

/** The dash a range is built around, spaced the way an editor would set it. */
const RANGE_SEPARATOR = ' – '

/** The gap UTS#35 inserts between a currency symbol and its amount. */
const NBSP = ' '

/**
 * The bidi marks ICU attaches to a currency symbol. Measured identical in
 * workerd and WebKit for all 3,657 locale-and-currency pairs the runtimes know,
 * which is why they can be read from `Intl` rather than frozen.
 */
const BIDI_MARK = /[\u200e\u200f\u061c]/g

/**
 * UTS#35's currency-spacing test, spelled the way ICU spells it: the gap goes in
 * unless the character facing the amount is in the Unicode *symbol* category.
 * `€`, `£` and `¥` are symbols and sit flush against the figure; the `r` of `kr`,
 * the `ł` of `zł` and the full stop of `р.` are not, and take the gap.
 */
const SYMBOL = /\p{S}/u

/** The fields a date pattern can carry, longest first so `{MMMM}` wins. */
const FIELD = /\{(MMMM|MMM|M|d|y|E)\}/g

/**
 * `Intl` instances, cached per locale at module scope.
 *
 * Construction is the expensive part of `Intl` — an SSR pass renders hundreds of
 * amounts in one locale, and building a formatter per call is how a costs screen
 * spends its CPU budget on ICU rather than on the page.
 */
const monthYearFormatters = new Map<Locale, Intl.DateTimeFormat>()
const numberFormatters = new Map<Locale, Intl.NumberFormat>()
const percentFormatters = new Map<Locale, Intl.NumberFormat>()
const fixedFormatters = new Map<string, Intl.NumberFormat>()
const rateInputFormatters = new Map<Locale, Intl.NumberFormat>()
const decimalMarks = new Map<Locale, '.' | ','>()
const currencySymbols = new Map<string, string>()

/** The frozen row for a locale: names, patterns and layouts, no `Intl`. */
function formatsFor(locale: Locale): LocaleFormats {
  return LOCALE_FORMATS[locale]
}

function monthYearFormatter(locale: Locale): Intl.DateTimeFormat {
  const cached = monthYearFormatters.get(locale)
  if (cached !== undefined) {
    return cached
  }
  const made = new Intl.DateTimeFormat(formatsFor(locale).intlLocale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  monthYearFormatters.set(locale, made)
  return made
}

/**
 * Every `Intl.NumberFormat` this module builds is built here.
 *
 * Both fields a number formatter would otherwise read out of the runtime's own
 * ICU are handed to it from the frozen row: the numbering system, carried by
 * the `-u-nu-latn` tag, and the CLDR grouping rule. Stating them at one place
 * rather than at each call site is the point — the divergence this closes was a
 * default nobody had written down, and a fourth formatter added later inherits
 * the answer instead of having to remember it.
 */
function makeNumberFormat(
  locale: Locale,
  options: Omit<Intl.NumberFormatOptions, 'useGrouping'> = {},
): Intl.NumberFormat {
  const formats = formatsFor(locale)
  return new Intl.NumberFormat(formats.intlLocale, {
    ...options,
    useGrouping: formats.grouping,
  })
}

function numberFormatter(locale: Locale): Intl.NumberFormat {
  const cached = numberFormatters.get(locale)
  if (cached !== undefined) {
    return cached
  }
  const made = makeNumberFormat(locale)
  numberFormatters.set(locale, made)
  return made
}

function percentFormatter(locale: Locale): Intl.NumberFormat {
  const cached = percentFormatters.get(locale)
  if (cached !== undefined) {
    return cached
  }
  const made = makeNumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  })
  percentFormatters.set(locale, made)
  return made
}

/** A decimal formatter pinned to a currency's minor-unit digits. */
function fixedFormatter(locale: Locale, digits: number): Intl.NumberFormat {
  const key = `${locale}:${digits}`
  const cached = fixedFormatters.get(key)
  if (cached !== undefined) {
    return cached
  }
  const made = makeNumberFormat(locale, {
    style: 'decimal',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  fixedFormatters.set(key, made)
  return made
}

/**
 * The narrow symbol for a currency in this locale — `€`, `¥`, `zł`.
 *
 * Read from `Intl` rather than frozen because the symbol is the one part of a
 * currency that every runtime agreed on, for all twenty-three locales and every
 * code `Intl.supportedValuesOf('currency')` knows. What they disagreed about is
 * the *spacing* around it and the number of minor units, and both of those come
 * from the frozen table.
 *
 * `narrowSymbol` is not a cosmetic preference. `en-GB` disambiguates by default —
 * `JP¥`, `US$`, `CA$` — and three glyphs of prefix in front of a 48px display
 * numeral is what pushed the costs summary out of its own card. The trip already
 * names its currency in the header, so the narrow symbol is unambiguous here.
 */
function narrowSymbol(locale: Locale, code: string): string {
  const key = `${locale}:${code}`
  const cached = currencySymbols.get(key)
  if (cached !== undefined) {
    return cached
  }
  const parts = makeNumberFormat(locale, {
    style: 'currency',
    currency: code,
    currencyDisplay: 'narrowSymbol',
  }).formatToParts(0)
  const at = parts.findIndex((part) => part.type === 'currency')
  const glyphs = at < 0 ? code : parts[at].value
  // Thirteen Arabic abbreviations end in a full stop, which is bidi-neutral:
  // without a mark after it, `د.إ.` borrows its direction from whatever the
  // sentence puts next to it and reads back to front. ICU emits the mark in the
  // literal that follows the symbol; the rest of that literal is the spacing,
  // which is the part the runtimes fight about, so only the mark is kept.
  const marks = parts
    .slice(at + 1, at + 2)
    .filter((part) => part.type === 'literal')
    .flatMap((part) => part.value.match(BIDI_MARK) ?? [])
    .join('')
  const symbol = `${glyphs}${marks}`
  currencySymbols.set(key, symbol)
  return symbol
}

/** Substitutes `{d}`, `{M}`, `{MMM}`, `{MMMM}`, `{y}` and `{E}` into a pattern. */
function render(pattern: string, fields: Record<string, string>): string {
  return pattern.replace(
    FIELD,
    (match, field: string) => fields[field] ?? match,
  )
}

/** Composes one date out of the locale's frozen names and its frozen pattern. */
function compose(date: Date, formats: LocaleFormats, pattern: string): string {
  const month = date.getUTCMonth()
  const weekday = date.getUTCDay()
  return render(pattern, {
    d: String(date.getUTCDate()),
    M: String(month + 1),
    MMM: (formats.monthsShortInDate ?? formats.monthsShort)[month],
    MMMM: formats.monthsLong[month],
    y: String(date.getUTCFullYear()),
    E: (formats.weekdaysShortInDate ?? formats.weekdaysShort)[weekday],
  })
}

/**
 * Does this locale lead with the day?
 *
 * It decides which end of a range collapses. `23 – 30 Jun 2026` drops the
 * repeated month from the *first* date because English starts with the day;
 * `2026年6月23日 – 30日` drops it from the *second* because Japanese ends with it.
 * Collapsing the wrong end produces a date nobody writes.
 */
function leadsWithDay(formats: LocaleFormats): boolean {
  const pattern = formats.patterns.date
  return pattern.indexOf('{d}') < pattern.indexOf('{y}')
}

/** Parses a `YYYY-MM-DD` column into a UTC date, or `null` when it is unusable. */
export function parseIsoDate(value: string | null | undefined): Date | null {
  if (typeof value !== 'string' || value.length < 10) {
    return null
  }
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** Parses a full ISO instant, or `null`. */
export function parseInstant(value: string | null | undefined): Date | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** How wide a month or weekday name is written. */
export type NameWidth = 'short' | 'long'

/**
 * The name of a month, standalone: `Sept`, `Σεπτέμβριος`, `wrzesień`.
 *
 * Standalone is the distinction that matters. Several locales inflect a month
 * differently inside a date than they do as a label — Greek writes
 * `Σεπτεμβρίου` in `15 Σεπτεμβρίου 2026` and `Σεπτέμβριος` on its own — and the
 * two runtimes do not even agree on which one a bare `{ month: 'long' }` returns.
 * This is the label form; the date form is composed by `formatDate`.
 */
export function monthName(
  month: number,
  locale: Locale = DEFAULT_LOCALE,
  width: NameWidth = 'short',
): string | null {
  if (!Number.isInteger(month) || month < 0 || month > 11) {
    return null
  }
  const formats = formatsFor(locale)
  return width === 'long'
    ? formats.monthsLong[month]
    : formats.monthsShort[month]
}

/** The name of a weekday, indexed the way `getUTCDay()` counts: `0` is Sunday. */
export function weekdayName(
  weekday: number,
  locale: Locale = DEFAULT_LOCALE,
  width: NameWidth = 'short',
): string | null {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return null
  }
  const formats = formatsFor(locale)
  return width === 'long'
    ? formats.weekdaysLong[weekday]
    : formats.weekdaysShort[weekday]
}

/** `2026-06-23` → `23 Jun 2026`, in this locale's own order and script. */
export function formatDate(
  value: string | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  const parsed = parseIsoDate(value) ?? parseInstant(value)
  if (parsed === null) {
    return null
  }
  const formats = formatsFor(locale)
  return compose(parsed, formats, formats.patterns.date)
}

/** `2026-06-23` → `23 Jun`, for a row that already establishes the year. */
export function formatDayMonth(
  value: string | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  const parsed = parseIsoDate(value) ?? parseInstant(value)
  if (parsed === null) {
    return null
  }
  const formats = formatsFor(locale)
  return compose(parsed, formats, formats.patterns.dayMonth)
}

/** `2026-06-23` → `Tue 23 Jun`. */
export function formatWeekday(
  value: string | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  const parsed = parseIsoDate(value) ?? parseInstant(value)
  if (parsed === null) {
    return null
  }
  const formats = formatsFor(locale)
  return compose(parsed, formats, formats.patterns.weekdayDate)
}

/**
 * `2026-06-01` → `June 2026`.
 *
 * The one date form still composed by `Intl`: `{ month: 'long', year: 'numeric' }`
 * was byte-identical in workerd, WebKit and Chromium for all twenty-three
 * locales, including the Greek month whose bare form is not, and the parity spec
 * keeps it that way.
 */
export function formatMonthYear(
  value: string | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  const parsed = parseIsoDate(value) ?? parseInstant(value)
  return parsed === null ? null : monthYearFormatter(locale).format(parsed)
}

/**
 * `23 – 30 Jun 2026`, collapsing the repeated month and year the way an
 * editorial style guide would — from whichever end of the pattern repeats.
 *
 * An open-ended range is the one place a formatter would need a connector word,
 * and words are the catalogue's job: English keeps `From 23 Jun 2026`, and every
 * other locale gets the language-neutral interval dash rather than a translation
 * invented here.
 */
export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  const from = parseIsoDate(start)
  const to = parseIsoDate(end)

  if (from === null && to === null) {
    return null
  }
  const formats = formatsFor(locale)
  const full = (date: Date): string =>
    compose(date, formats, formats.patterns.date)

  if (from === null) {
    return to === null
      ? null
      : formats.patterns.rangeOpenStart.replace('{date}', full(to))
  }
  if (to === null) {
    return formats.patterns.rangeOpenEnd.replace('{date}', full(from))
  }
  if (from.getTime() === to.getTime()) {
    return full(from)
  }
  if (from.getUTCFullYear() !== to.getUTCFullYear()) {
    return `${full(from)}${RANGE_SEPARATOR}${full(to)}`
  }

  const shared =
    from.getUTCMonth() === to.getUTCMonth()
      ? formats.patterns.day
      : formats.patterns.dayMonth
  return leadsWithDay(formats)
    ? `${compose(from, formats, shared)}${RANGE_SEPARATOR}${full(to)}`
    : `${full(from)}${RANGE_SEPARATOR}${compose(to, formats, shared)}`
}

/** A `HH:MM` column, trimmed of seconds. Returns `null` for an empty column. */
export function formatTime(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.length < 4) {
    return null
  }
  return value.slice(0, 5)
}

/** `10:00 – 16:00`, or just the one side that exists. */
export function formatTimeRange(
  start: string | null | undefined,
  end: string | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  const from = formatTime(start)
  const to = formatTime(end)
  if (from === null && to === null) {
    return null
  }
  if (from === null) {
    return formatsFor(locale).patterns.timeOpenStart.replace('{time}', to ?? '')
  }
  return to === null ? from : `${from}${RANGE_SEPARATOR}${to}`
}

/** Whole days from `today` to `value`. Negative when it has already passed. */
export function daysUntil(
  value: string | null | undefined,
  today: string,
): number | null {
  const target = parseIsoDate(value)
  const from = parseIsoDate(today)
  if (target === null || from === null) {
    return null
  }
  return Math.round((target.getTime() - from.getTime()) / DAY_MS)
}

/** Inclusive day count of a date range — a 23rd-to-30th trip is 8 days long. */
export function daysBetween(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  const from = parseIsoDate(start)
  const to = parseIsoDate(end)
  if (from === null || to === null) {
    return null
  }
  return Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1
}

/** `1234` → `1,234`, grouped the way this locale groups. */
export function formatNumber(
  value: number,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return numberFormatter(locale).format(value)
}

/**
 * An exchange rate: two fraction digits at least, four at most.
 *
 * A rate is not money — it has no currency and so none of the currency layout
 * the frozen table carries — but it does take the locale's decimal mark and
 * grouping. The window is what a reader needs to see that `1.95` and `1.9512`
 * are different rates without printing a tail of noise on a round one.
 */
export function formatRate(
  value: number,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return makeNumberFormat(locale, {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value)
}

/**
 * The other way round of a rate, for the sentence that lets a reader see a rate typed the wrong way
 * round: six significant digits, grouped, so `1 / 52631` reads `0.0000190` and not `0.00`, where
 * {@link formatRate}'s four fraction digits would round it away.
 */
export function formatInverseRate(
  value: number,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return makeNumberFormat(locale, {
    style: 'decimal',
    maximumSignificantDigits: 6,
  }).format(value)
}

/**
 * An exchange rate as the text a field should hold: the locale's decimal mark, no grouping and as
 * many significant digits as the rate has (ten at most), so `0.0000115` is not shown as `0.00`.
 *
 * The numbering system is the frozen row's, like every other number here; grouping is off because
 * the reader is about to edit the text, and `parseRate` (`#/lib/money`) reads it back.
 */
export function formatRateInput(
  value: number,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const cached = rateInputFormatters.get(locale)
  const formatter =
    cached ??
    new Intl.NumberFormat(formatsFor(locale).intlLocale, {
      useGrouping: false,
      maximumSignificantDigits: 10,
    })
  if (cached === undefined) {
    rateInputFormatters.set(locale, formatter)
  }
  return formatter.format(value)
}

/**
 * The mark this locale writes between a whole number and its fraction: `,` for `pl`, `de`, `fr`,
 * `.` for `en`, `ja`, `zh`. Read from the frozen row's numbering system like every other number
 * here, and narrowed to the two marks a field can hold: `parseMoney` (`#/lib/money`) uses it to
 * settle the one figure its shape cannot, a lone separator followed by three digits.
 */
export function decimalMark(locale: Locale = DEFAULT_LOCALE): '.' | ',' {
  const cached = decimalMarks.get(locale)
  if (cached !== undefined) {
    return cached
  }
  const part = new Intl.NumberFormat(formatsFor(locale).intlLocale)
    .formatToParts(1.5)
    .find((entry) => entry.type === 'decimal')
  const mark = part?.value === ',' ? ',' : '.'
  decimalMarks.set(locale, mark)
  return mark
}

/** `-3` → `3`, keeping the sign out of a label that already says "ago". */
export function formatAbsolute(
  value: number,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return numberFormatter(locale).format(Math.abs(value))
}

/** A three-letter code we are willing to hand to `Intl`. */
function currencyCode(currency: string): string {
  const code = currency.trim().toUpperCase()
  return /^[A-Z]{3}$/.test(code) ? code : 'EUR'
}

/**
 * How many minor units the currency actually has — 2 for EUR, 0 for JPY, 3 for
 * KWD. Frozen rather than resolved, because workerd and WebKit disagree about
 * `HUF` and `IDR`, and that disagreement changes the amount rather than its
 * punctuation.
 */
export function minorUnitDigits(currency: string): number {
  return CURRENCY_MINOR_DIGITS[currencyCode(currency)] ?? DEFAULT_MINOR_DIGITS
}

/** The currency-spacing gap: empty when a glyph faces the amount, a space otherwise. */
function currencyGap(template: string, symbol: string): string {
  const gap = template.indexOf('{g}')
  if (gap < 0) {
    return ''
  }
  const adjacent =
    template.indexOf('{s}') < gap ? symbol.slice(-1) : symbol.slice(0, 1)
  return SYMBOL.test(adjacent) ? '' : NBSP
}

/**
 * Minor units into the row's own currency: `123456` EUR → `€1,234.56`, and
 * `74912300` JPY → `¥74,912,300`, because a zero-decimal currency is never
 * divided by a hundred it does not use.
 *
 * Composed from the locale's frozen layout rather than handed to `Intl` whole.
 * The symbol and the grouped amount are the parts every runtime agreed on; the
 * space between them is not — workerd writes `zł 1.234,50` in Indonesian where
 * WebKit writes `zł1.234,50` — so the layout is a table and the pieces are slotted
 * into it.
 */
export function formatMoneyMinor(
  minor: number,
  currency: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const code = currencyCode(currency)
  const digits = minorUnitDigits(code)
  const formats = formatsFor(locale)
  const symbol = narrowSymbol(locale, code)
  const template =
    minor < 0 ? formats.currency.negative : formats.currency.positive
  const amount = fixedFormatter(locale, digits).format(
    Math.abs(minor) / 10 ** digits,
  )
  return template
    .replace('{g}', currencyGap(template, symbol))
    .replace('{s}', symbol)
    .replace('{n}', amount)
}

/**
 * A published price, with the cents dropped when they are zero.
 *
 * `$9` reads as a price where `$9.00` reads as a transaction, which is why the
 * plan cards and the pricing table want this rather than `formatMoneyMinor`. It
 * lives here rather than in `plans.ts` because the layout it slots into is the
 * same frozen per-locale template: `plans.ts` had its own `Intl.NumberFormat`
 * pinned to `en-US`, so every price in the product read American whatever the
 * reader's language, and it bypassed the workerd/WebKit gap documented above.
 */
export function formatPrice(
  minor: number,
  currency: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const code = currencyCode(currency)
  const digits = minorUnitDigits(code)
  const whole = minor % 10 ** digits === 0
  const formats = formatsFor(locale)
  const symbol = narrowSymbol(locale, code)
  const template =
    minor < 0 ? formats.currency.negative : formats.currency.positive
  const amount = fixedFormatter(locale, whole ? 0 : digits).format(
    Math.abs(minor) / 10 ** digits,
  )
  return template
    .replace('{g}', currencyGap(template, symbol))
    .replace('{s}', symbol)
    .replace('{n}', amount)
}

/** The same amount with the symbol dropped — for a column that already names it. */
export function formatMoneyMinorPlain(
  minor: number,
  currency: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const digits = minorUnitDigits(currency)
  return fixedFormatter(locale, digits).format(minor / 10 ** digits)
}

/** Metres into the traveller's unit, rounded to whole km or miles. */
export function formatDistance(
  metres: number,
  unit: 'metric' | 'imperial',
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (unit === 'imperial') {
    return `${formatNumber(Math.round(metres / 1609.344), locale)} mi`
  }
  return `${formatNumber(Math.round(metres / 1000), locale)} km`
}

/** Grams into the lightest sensible unit: `840 g`, `2.4 kg`. */
export function formatWeight(
  grams: number,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (grams < 1000) {
    return `${formatNumber(grams, locale)} g`
  }
  const kilos = grams / 1000
  return `${formatNumber(Math.round(kilos * 10) / 10, locale)} kg`
}

/** `0.42` → `42%`, punctuated and placed the way this locale does it. */
export function formatPercent(
  ratio: number,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const clamped = Math.min(Math.max(ratio, 0), 1)
  return percentFormatter(locale).format(Math.round(clamped * 100) / 100)
}

/**
 * The forms a count can take in one locale, keyed by CLDR plural category.
 *
 * A locale that has no `one` simply does not carry one; anything the rules
 * select that is missing falls back to `other`, which every locale has.
 */
export type PluralForms = PluralPatterns

/** Picks the form this count takes and puts the grouped count in front of it. */
function agree(count: number, locale: Locale, forms: PluralForms): string {
  const form = forms[plural(locale, count)] ?? forms.other
  return `${formatNumber(count, locale)} ${form}`
}

/**
 * `1 place` / `4 places`, with the count already grouped.
 *
 * Two shapes, and the split is deliberate. The first takes an English singular
 * and has **no locale parameter at all**, because English two-form agreement is
 * only ever right in English: it is pinned to `en`, and it exists so the thirty
 * screens that predate the catalogue keep rendering while their copy moves into
 * `t()`. The second is the localised shape — hand it a locale and that locale's
 * own CLDR forms, and the category comes from `#/lib/i18n`'s plural layer, which
 * is the one platform call §8.5's measurement cleared for use at render time.
 *
 * There is no way to spell "English words in Polish": the shorthand cannot be
 * given another locale, and the localised form cannot be given a bare English
 * noun.
 */
export function pluralise(
  count: number,
  singular: string,
  plural?: string,
): string
export function pluralise(
  count: number,
  locale: Locale,
  forms: PluralForms,
): string
export function pluralise(
  count: number,
  wordOrLocale: string,
  pluralOrForms?: string | PluralForms,
): string {
  if (typeof pluralOrForms === 'object') {
    return agree(
      count,
      isSupportedLocale(wordOrLocale) ? wordOrLocale : DEFAULT_LOCALE,
      pluralOrForms,
    )
  }
  return agree(count, DEFAULT_LOCALE, {
    one: wordOrLocale,
    other: pluralOrForms ?? `${wordOrLocale}s`,
  })
}

/**
 * How long ago an instant was, in the coarse grain a feed actually needs.
 *
 * The wording is CLDR's short relative-time form, frozen: `Intl.RelativeTimeFormat`
 * disagrees with itself between workerd and WebKit in Russian and Traditional
 * Chinese, and a timestamp that changes on hydration is the same defect as a
 * month name that does.
 */
export function formatRelative(
  value: string | null | undefined,
  now: number,
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  const parsed = parseInstant(value)
  if (parsed === null) {
    return null
  }
  const formats = formatsFor(locale)
  const elapsed = (count: number, patterns: PluralForms): string =>
    (patterns[plural(locale, count)] ?? patterns.other).replace(
      '{n}',
      formatNumber(count, locale),
    )

  const seconds = Math.round((now - parsed.getTime()) / 1000)
  if (seconds < 45) {
    return formats.relative.now
  }
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) {
    return elapsed(minutes, formats.relative.minute)
  }
  const hours = Math.round(minutes / 60)
  if (hours < 24) {
    return elapsed(hours, formats.relative.hour)
  }
  const days = Math.round(hours / 24)
  if (days < 7) {
    return elapsed(days, formats.relative.day)
  }
  return compose(parsed, formats, formats.patterns.date)
}

/**
 * `Anna, Iwo and Marek` — a conjunction list in this locale's own punctuation.
 *
 * `Intl.ListFormat` is the obvious answer and is the wrong one: WebKit wraps
 * every Arabic item in U+2068/U+2069 isolate characters and workerd does not, so
 * a list of travellers rendered on the server is a different string in Safari.
 * The four separators CLDR actually uses are frozen instead.
 */
export function formatList(
  items: ReadonlyArray<string>,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const parts = items.filter((item) => item.length > 0)
  if (parts.length === 0) {
    return ''
  }
  if (parts.length === 1) {
    return parts[0]
  }
  const { pair, start, middle, end } = formatsFor(locale).list
  if (parts.length === 2) {
    return `${parts[0]}${pair}${parts[1]}`
  }
  const last = parts[parts.length - 1]
  const head = parts.slice(0, -1)
  return `${head[0]}${start}${head.slice(1).join(middle)}${end}${last}`
}

/**
 * A short text column reduced to "we have a value" or "we do not".
 *
 * Several of our own columns are validated by `shortTextSchema`, which trims but
 * has no `.min(1)`, so a write of `''` stores an empty string and a bare
 * `!== null` check treats it as data. Downstream that renders as a separator with
 * nothing after it — `FR ·` — and announces as a doubled comma, both of which
 * read as a rendering failure rather than as missing data. One guard, so every
 * surface that prints one of those columns agrees on what absent means.
 */
export function trimmedOrNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** Turns a dotted enum value into sentence case: `bank_transfer` → `Bank transfer`. */
export function humaniseToken(value: string): string {
  const words = value.replace(/[._-]+/g, ' ').trim()
  if (words.length === 0) {
    return value
  }
  return words.slice(0, 1).toUpperCase() + words.slice(1)
}

/** Two-letter country code into its flag, so the atlas needs no image assets. */
export function countryFlag(code: string): string {
  const upper = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(upper)) {
    return '🏳️'
  }
  return String.fromCodePoint(
    ...[...upper].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65),
  )
}

/** Calendar years are identifiers: Latin digits, without quantity grouping. */
export function formatYear(
  year: number,
  locale: Locale = DEFAULT_LOCALE,
): string {
  // The locale remains explicit at each call site like the other formatters.
  void locale
  return String(year)
}
