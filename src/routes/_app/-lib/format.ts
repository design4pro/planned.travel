/**
 * Presentation formatters shared by every module screen.
 *
 * The locale is pinned rather than taken from the browser: the server renders
 * these strings first, and a locale that differs between the two would produce
 * a hydration mismatch on every date and every amount on the page.
 */

const LOCALE = 'en-GB'

const DAY_MS = 86_400_000

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

const dayMonthFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

const weekdayFormatter = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

const monthYearFormatter = new Intl.DateTimeFormat(LOCALE, {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const numberFormatter = new Intl.NumberFormat(LOCALE)

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

/** `2026-06-23` → `23 Jun 2026`. */
export function formatDate(value: string | null | undefined): string | null {
  const parsed = parseIsoDate(value) ?? parseInstant(value)
  return parsed === null ? null : dateFormatter.format(parsed)
}

/** `2026-06-23` → `Tue, 23 Jun`. */
export function formatWeekday(value: string | null | undefined): string | null {
  const parsed = parseIsoDate(value) ?? parseInstant(value)
  return parsed === null ? null : weekdayFormatter.format(parsed)
}

/** `2026-06-01` → `June 2026`. */
export function formatMonthYear(
  value: string | null | undefined,
): string | null {
  const parsed = parseIsoDate(value) ?? parseInstant(value)
  return parsed === null ? null : monthYearFormatter.format(parsed)
}

/**
 * `23 – 30 Jun 2026`, collapsing the repeated month and year the way an
 * editorial style guide would.
 */
export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  const from = parseIsoDate(start)
  const to = parseIsoDate(end)

  if (from === null && to === null) {
    return null
  }
  if (from === null) {
    return to === null ? null : `Until ${dateFormatter.format(to)}`
  }
  if (to === null) {
    return `From ${dateFormatter.format(from)}`
  }
  if (from.getTime() === to.getTime()) {
    return dateFormatter.format(from)
  }
  if (from.getUTCFullYear() !== to.getUTCFullYear()) {
    return `${dateFormatter.format(from)} – ${dateFormatter.format(to)}`
  }
  if (from.getUTCMonth() !== to.getUTCMonth()) {
    return `${dayMonthFormatter.format(from)} – ${dateFormatter.format(to)}`
  }
  return `${from.getUTCDate()} – ${dateFormatter.format(to)}`
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
): string | null {
  const from = formatTime(start)
  const to = formatTime(end)
  if (from === null && to === null) {
    return null
  }
  if (from === null) {
    return `until ${to ?? ''}`
  }
  return to === null ? from : `${from} – ${to}`
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

/** `1234` → `1,234`. */
export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

/** `-3` → `3`, keeping the sign out of a label that already says "ago". */
export function formatAbsolute(value: number): string {
  return numberFormatter.format(Math.abs(value))
}

/** A three-letter code we are willing to hand to `Intl`. */
function currencyCode(currency: string): string {
  const code = currency.trim().toUpperCase()
  return /^[A-Z]{3}$/.test(code) ? code : 'EUR'
}

/** How many minor units the currency actually has — 2 for EUR, 0 for JPY. */
function minorDigits(formatter: Intl.NumberFormat): number {
  return formatter.resolvedOptions().minimumFractionDigits ?? 2
}

/**
 * Minor units into the row's own currency: `74912300` JPY → `¥749,123`.
 * `Intl` resolves how many minor units the currency actually has, so a
 * zero-decimal currency is never divided by a hundred it does not use.
 *
 * `narrowSymbol` is not a cosmetic preference. `en-GB` disambiguates by default
 * — `JP¥`, `US$`, `CA$` — and three glyphs of prefix in front of a 48px display
 * numeral is what pushed the costs summary out of its own card. The trip already
 * names its currency in the header, so the narrow symbol is unambiguous here.
 */
export function formatMoneyMinor(minor: number, currency: string): string {
  const formatter = new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: currencyCode(currency),
    currencyDisplay: 'narrowSymbol',
  })
  const digits = minorDigits(formatter)
  return formatter.format(minor / 10 ** digits)
}

/** The same amount with the symbol dropped — for a column that already names it. */
export function formatMoneyMinorPlain(minor: number, currency: string): string {
  const code = currencyCode(currency)
  const digits = minorDigits(
    new Intl.NumberFormat(LOCALE, { style: 'currency', currency: code }),
  )
  return new Intl.NumberFormat(LOCALE, {
    style: 'decimal',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(minor / 10 ** digits)
}

/** Metres into the traveller's unit, rounded to whole km or miles. */
export function formatDistance(
  metres: number,
  unit: 'metric' | 'imperial',
): string {
  if (unit === 'imperial') {
    return `${numberFormatter.format(Math.round(metres / 1609.344))} mi`
  }
  return `${numberFormatter.format(Math.round(metres / 1000))} km`
}

/** Grams into the lightest sensible unit: `840 g`, `2.4 kg`. */
export function formatWeight(grams: number): string {
  if (grams < 1000) {
    return `${numberFormatter.format(grams)} g`
  }
  const kilos = grams / 1000
  return `${numberFormatter.format(Math.round(kilos * 10) / 10)} kg`
}

/** `0.42` → `42%`. */
export function formatPercent(ratio: number): string {
  return `${Math.round(Math.min(Math.max(ratio, 0), 1) * 100)}%`
}

/** `1 place` / `4 places`, with the count already grouped. */
export function pluralise(
  count: number,
  singular: string,
  plural?: string,
): string {
  const word = count === 1 ? singular : (plural ?? `${singular}s`)
  return `${numberFormatter.format(count)} ${word}`
}

/** How long ago an instant was, in the coarse grain a feed actually needs. */
export function formatRelative(
  value: string | null | undefined,
  now: number,
): string | null {
  const parsed = parseInstant(value)
  if (parsed === null) {
    return null
  }
  const seconds = Math.round((now - parsed.getTime()) / 1000)
  if (seconds < 45) {
    return 'just now'
  }
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) {
    return `${minutes}m ago`
  }
  const hours = Math.round(minutes / 60)
  if (hours < 24) {
    return `${hours}h ago`
  }
  const days = Math.round(hours / 24)
  if (days < 7) {
    return `${days}d ago`
  }
  return dateFormatter.format(parsed)
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

const regionNames = new Intl.DisplayNames([LOCALE], { type: 'region' })

/** `JP` → `Japan`. Falls back to the code itself for anything unrecognised. */
export function countryName(code: string): string {
  const upper = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(upper)) {
    return code
  }
  return regionNames.of(upper) ?? upper
}
