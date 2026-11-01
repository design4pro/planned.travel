import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { LOCALE_TAGS } from '#/lib/i18n'
import type { Locale } from '#/lib/i18n'
import {
  CURRENCY_MINOR_DIGITS,
  DEFAULT_MINOR_DIGITS,
  LOCALE_FORMATS,
} from '../format-tables'
import {
  formatDate,
  formatDateRange,
  formatDayMonth,
  formatDistance,
  formatPrecipitation,
  formatSpeed,
  formatList,
  formatMonthYear,
  formatMoneyMinor,
  formatMoneyMinorPlain,
  formatNumber,
  formatPercent,
  formatRelative,
  formatTimeRange,
  formatWeekday,
  formatWeight,
  minorUnitDigits,
  monthName,
  pluralise,
  weekdayName,
} from '../format'

/**
 * The multi-locale formatter, held to the two things `docs/SPEC.md` §8.5 asks
 * of it: that it renders the same bytes in every runtime, and that adding
 * twenty-two languages did not move a single character of the English the
 * product already ships.
 *
 * The cross-runtime half cannot be proven here — this suite runs on V8, which
 * agrees with workerd about everything and with WebKit about rather less, so a
 * green run in Node says nothing about Safari. `e2e/i18n-runtime-parity.spec.ts`
 * is where that is measured. What *can* be proven here is the property that
 * makes the runtimes agree in the first place: that no date, list, relative time
 * or money layout is composed by `Intl` at all.
 */

const NBSP = ' '
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('the English output every existing caller depends on', () => {
  it('formats a date the way it always has, September included', () => {
    expect(formatDate('2026-06-23')).toBe('23 Jun 2026')
    // The original bug: workerd abbreviates September to four letters and the
    // WebKit that Safari ships abbreviates it to three.
    expect(formatDate('2026-09-06')).toBe('6 Sept 2026')
    expect(formatDate('2026-06-23T14:30:00.000Z')).toBe('23 Jun 2026')
    expect(formatDate(null)).toBeNull()
    expect(formatDate('not a date')).toBeNull()
  })

  it('formats a weekday, a day-month and a month-year', () => {
    expect(formatWeekday('2026-06-23')).toBe('Tue 23 Jun')
    expect(formatDayMonth('2026-06-23')).toBe('23 Jun')
    expect(formatMonthYear('2026-06-01')).toBe('June 2026')
  })

  it('collapses a range the way an editor would', () => {
    expect(formatDateRange('2026-06-23', '2026-06-30')).toBe('23 – 30 Jun 2026')
    expect(formatDateRange('2026-06-23', '2026-07-03')).toBe(
      '23 Jun – 3 Jul 2026',
    )
    expect(formatDateRange('2026-12-28', '2027-01-04')).toBe(
      '28 Dec 2026 – 4 Jan 2027',
    )
    expect(formatDateRange('2026-06-23', '2026-06-23')).toBe('23 Jun 2026')
    expect(formatDateRange(null, '2026-06-30')).toBe('Until 30 Jun 2026')
    expect(formatDateRange('2026-06-23', null)).toBe('From 23 Jun 2026')
    expect(formatDateRange(null, null)).toBeNull()
  })

  it('formats a clock range', () => {
    expect(formatTimeRange('10:00', '16:00')).toBe('10:00 – 16:00')
    expect(formatTimeRange('10:00', null)).toBe('10:00')
    expect(formatTimeRange(null, '16:00')).toBe('until 16:00')
    expect(formatTimeRange(null, null)).toBeNull()
  })

  it('formats rain and wind in the reader’s unit, and never reads a trace of rain as zero', () => {
    expect(formatPrecipitation(5.14, 'metric')).toBe('5.1 mm')
    expect(formatPrecipitation(25.4, 'imperial')).toBe('1 in')
    expect(formatPrecipitation(5.1, 'imperial')).toBe('0.2 in')
    expect(formatPrecipitation(1, 'imperial')).toBe('0.04 in')
    // Above zero but under what the unit shows: a lower bound, not a rounded-down zero.
    expect(formatPrecipitation(0.04, 'metric')).toBe('<0.1 mm')
    expect(formatPrecipitation(0.1, 'imperial')).toBe('<0.01 in')
    expect(formatPrecipitation(0.05, 'metric')).toBe('0.1 mm')
    expect(formatPrecipitation(0.26, 'imperial')).toBe('0.01 in')
    expect(formatPrecipitation(0, 'metric')).toBe('0 mm')
    expect(formatPrecipitation(0, 'imperial')).toBe('0 in')
    expect(formatPrecipitation(0.04, 'metric', 'de')).toBe('<0,1 mm')
    expect(formatSpeed(5, 'metric')).toBe('18 km/h')
    expect(formatSpeed(0.4, 'metric')).toBe('1 km/h')
    expect(formatSpeed(5, 'imperial')).toBe('11 mph')
    expect(formatSpeed(10, 'imperial')).toBe('22 mph')
  })

  it('formats numbers, money, distance, weight and percentages', () => {
    expect(formatNumber(1234)).toBe('1,234')
    expect(formatMoneyMinor(123456, 'EUR')).toBe('€1,234.56')
    // A zero-decimal currency is never divided by a hundred it does not use:
    // 74912300 minor units of yen are 74912300 yen.
    expect(formatMoneyMinor(74912300, 'JPY')).toBe('¥74,912,300')
    expect(formatMoneyMinor(-123456, 'GBP')).toBe('-£1,234.56')
    expect(formatMoneyMinorPlain(123456, 'EUR')).toBe('1,234.56')
    expect(formatDistance(12_500, 'metric')).toBe('13 km')
    expect(formatDistance(12_500, 'imperial')).toBe('8 mi')
    expect(formatWeight(840)).toBe('840 g')
    expect(formatWeight(2400)).toBe('2.4 kg')
    expect(formatPercent(0.42)).toBe('42%')
    expect(formatPercent(1.4)).toBe('100%')
  })

  it('agrees a count with an English noun', () => {
    expect(pluralise(1, 'place')).toBe('1 place')
    expect(pluralise(4, 'place')).toBe('4 places')
    expect(pluralise(0, 'place')).toBe('0 places')
    expect(pluralise(3, 'entry', 'entries')).toBe('3 entries')
    expect(pluralise(1200, 'visit')).toBe('1,200 visits')
  })

  it('reads a feed timestamp in the same compact wording', () => {
    const now = Date.parse('2026-06-23T12:00:00.000Z')
    const ago = (ms: number): string | null =>
      formatRelative(new Date(now - ms).toISOString(), now)

    expect(ago(10_000)).toBe('just now')
    expect(ago(5 * MINUTE)).toBe('5m ago')
    expect(ago(3 * HOUR)).toBe('3h ago')
    expect(ago(2 * DAY)).toBe('2d ago')
    expect(ago(30 * DAY)).toBe('24 May 2026')
    expect(formatRelative(null, now)).toBeNull()
  })
})

describe('the frozen tables', () => {
  it('carry a complete row for every shipped locale and no others', () => {
    expect(Object.keys(LOCALE_FORMATS).sort()).toEqual([...LOCALE_TAGS].sort())

    for (const tag of LOCALE_TAGS) {
      const row = LOCALE_FORMATS[tag]
      expect(row.monthsShort, tag).toHaveLength(12)
      expect(row.monthsLong, tag).toHaveLength(12)
      expect(row.weekdaysShort, tag).toHaveLength(7)
      expect(row.weekdaysLong, tag).toHaveLength(7)
      expect(row.monthsShortInDate ?? row.monthsShort, tag).toHaveLength(12)
      expect(row.weekdaysShortInDate ?? row.weekdaysShort, tag).toHaveLength(7)

      const names = [
        ...row.monthsShort,
        ...row.monthsLong,
        ...row.weekdaysShort,
        ...row.weekdaysLong,
      ]
      for (const name of names) {
        expect(name.trim(), tag).not.toBe('')
        // A bare number is what a month name looks like when it has been read
        // out of a composed pattern rather than out of a standalone field:
        // Japanese writes `2026年1月`, so the month *part* of that form is `1`
        // and the 月 belongs to the pattern. `1` is not a month name.
        expect(name, tag).not.toMatch(/^\d+$/)
      }
    }
  })

  it('give every pattern the fields it needs', () => {
    for (const tag of LOCALE_TAGS) {
      const { patterns } = LOCALE_FORMATS[tag]
      expect(patterns.date, tag).toContain('{d}')
      expect(patterns.date, tag).toContain('{y}')
      expect(patterns.date, tag).toMatch(/\{MMM\}|\{M\}/)
      expect(patterns.dayMonth, tag).toContain('{d}')
      expect(patterns.dayMonth, tag).not.toContain('{y}')
      expect(patterns.weekdayDate, tag).toContain('{E}')
      expect(patterns.rangeOpenStart, tag).toContain('{date}')
      expect(patterns.rangeOpenEnd, tag).toContain('{date}')
      expect(patterns.timeOpenStart, tag).toContain('{time}')
      expect(patterns.day, tag).toContain('{d}')
    }
  })

  it('lay every currency out with an amount and a symbol', () => {
    for (const tag of LOCALE_TAGS) {
      const { currency } = LOCALE_FORMATS[tag]
      for (const template of [currency.positive, currency.negative]) {
        expect(template, tag).toContain('{s}')
        expect(template, tag).toContain('{n}')
      }
      expect(currency.negative, tag).not.toBe(currency.positive)
    }
  })

  it('freeze the minor units the runtimes disagree about', () => {
    // workerd says zero digits for both and WebKit says two, which changes the
    // amount rather than its punctuation.
    expect(CURRENCY_MINOR_DIGITS.HUF).toBe(0)
    expect(CURRENCY_MINOR_DIGITS.IDR).toBe(0)
    expect(CURRENCY_MINOR_DIGITS.JPY).toBe(0)
    expect(CURRENCY_MINOR_DIGITS.KWD).toBe(3)
    expect(minorUnitDigits('EUR')).toBe(DEFAULT_MINOR_DIGITS)
    expect(minorUnitDigits('huf')).toBe(0)
    expect(minorUnitDigits('nonsense')).toBe(DEFAULT_MINOR_DIGITS)
  })

  it('pin the numbering system and the grouping rule to workerd', () => {
    // Two more fields the runtimes answer differently, and neither shows up on
    // a macOS laptop. The Playwright container's linux WebKit resolves `ar` to
    // the `arab` numbering system — `١٠١` where workerd writes `101` — and
    // ignores the CLDR `minimumGroupingDigits=2` that makes Italian write
    // `1234,56` rather than `1.234,56`. Both are pinned to what workerd
    // renders, because the server's bytes are the ones a browser hydrates.
    for (const tag of LOCALE_TAGS) {
      const row = LOCALE_FORMATS[tag]
      expect(row.intlLocale, tag).toMatch(/-u-nu-latn$/)
      expect(
        new Intl.NumberFormat(row.intlLocale).resolvedOptions().numberingSystem,
        tag,
      ).toBe('latn')
      expect(['always', 'min2'], tag).toContain(row.grouping)
      // V8 is workerd's ICU for practical purposes, so asking it with neither
      // the extension nor the rule is the standing drift check on both: naming
      // them explicitly must not move a byte of what the runtime that renders
      // first would have written on its own.
      const platform = new Intl.NumberFormat(
        row.intlLocale.replace('-u-nu-latn', ''),
      )
      expect(formatNumber(1000, tag), tag).toBe(platform.format(1000))
      expect(formatNumber(1_234_567, tag), tag).toBe(platform.format(1_234_567))
    }
    // The four locales CLDR gives `minimumGroupingDigits=2`, measured in
    // workerd 1.20260815.1. Every other locale groups from four digits up, so
    // `always` and its locale default are the same string — asked for
    // explicitly all the same, because a default is precisely what the two
    // runtimes disagreed about.
    const min2 = LOCALE_TAGS.filter(
      (tag) => LOCALE_FORMATS[tag].grouping === 'min2',
    )
    expect(min2.sort()).toEqual(['es', 'hu', 'it', 'pl'])
  })

  it('keep the two Greek month forms apart', () => {
    // A bare month label is nominative; the same month inside a date is
    // genitive, and workerd and WebKit disagree about which one a lone
    // `{ month: 'long' }` returns. The label form is the one frozen here.
    expect(monthName(0, 'el', 'long')).toBe('Ιανουάριος')
    expect(monthName(8, 'en', 'short')).toBe('Sept')
    expect(monthName(5, 'ja', 'short')).toBe('6月')
    expect(monthName(12, 'en')).toBeNull()
    expect(weekdayName(0, 'ar')).toBe('الأحد')
    expect(weekdayName(1, 'ru')).toBe('пн')
    expect(weekdayName(7, 'en')).toBeNull()
  })

  it('name the month in the languages that number it', () => {
    // The counterpart of the Greek case, and the trap on the other side of it.
    // These four write their wide month as a numeral plus a word, and the word
    // lives in the *pattern* of the composed month-and-year form rather than in
    // its month field — so a table derived from that form leaves `1` behind.
    expect(monthName(0, 'ja', 'long')).toBe('1月')
    expect(monthName(11, 'ja', 'long')).toBe('12月')
    expect(monthName(0, 'zh-Hant', 'long')).toBe('1月')
    // Simplified Chinese spells the wide form and abbreviates the narrow one.
    expect(monthName(0, 'zh-Hans', 'long')).toBe('一月')
    expect(monthName(0, 'zh-Hans', 'short')).toBe('1月')
    // Vietnamese capitalises the standalone form and lower-cases the one that
    // sits inside a date, exactly as it does for the abbreviation.
    expect(monthName(0, 'vi', 'long')).toBe('Tháng 1')
    expect(monthName(0, 'vi', 'short')).toBe('Tháng 1')
  })
})

describe('a date in twenty-three languages', () => {
  const SAMPLE = '2026-06-23'

  it('is composed from the table, never from Intl.DateTimeFormat', () => {
    // The proof, rather than an assertion about it: if `Intl.DateTimeFormat`
    // cannot be constructed at all, every table-driven formatter still answers.
    // Only `formatMonthYear` is allowed to need it.
    const real = Intl.DateTimeFormat
    const forbidden = (): never => {
      throw new Error('Intl.DateTimeFormat is not allowed here')
    }
    try {
      Object.defineProperty(Intl, 'DateTimeFormat', {
        configurable: true,
        value: forbidden,
      })
      for (const tag of LOCALE_TAGS) {
        expect(formatDate(SAMPLE, tag), tag).not.toBeNull()
        expect(formatDayMonth(SAMPLE, tag), tag).not.toBeNull()
        expect(formatWeekday(SAMPLE, tag), tag).not.toBeNull()
        expect(formatDateRange(SAMPLE, '2026-06-30', tag), tag).not.toBeNull()
        expect(formatList(['A', 'B', 'C'], tag), tag).not.toBe('')
        expect(
          formatRelative('2026-06-23T11:00:00.000Z', Date.parse(SAMPLE), tag),
          tag,
        ).not.toBeNull()
      }
    } finally {
      Object.defineProperty(Intl, 'DateTimeFormat', {
        configurable: true,
        value: real,
      })
    }
  })

  it('reads the way each language writes a date', () => {
    expect(formatDate(SAMPLE, 'en')).toBe('23 Jun 2026')
    expect(formatDate(SAMPLE, 'de')).toBe('23. Juni 2026')
    expect(formatDate(SAMPLE, 'cs')).toBe('23. 6. 2026')
    expect(formatDate(SAMPLE, 'ja')).toBe('2026年6月23日')
    expect(formatDate(SAMPLE, 'ko')).toBe('2026년 6월 23일')
    expect(formatDate(SAMPLE, 'hu')).toBe('2026. jún. 23.')
    // The two the runtimes disagreed about: Catalan keeps its `del`, Russian
    // keeps the abbreviated month and its `г.`
    expect(formatDate(SAMPLE, 'ca')).toBe('23 de juny del 2026')
    expect(formatDate(SAMPLE, 'ru')).toBe('23 июн. 2026 г.')
    expect(formatDate('2026-01-15', 'vi')).toBe('15 thg 1, 2026')
  })

  it('collapses a range from whichever end repeats', () => {
    // Day-first languages drop the repeated month from the first date.
    expect(formatDateRange(SAMPLE, '2026-06-30', 'de')).toBe(
      '23. – 30. Juni 2026',
    )
    // Day-last languages drop it from the second, because collapsing the front
    // of `2026年6月23日` would produce a date nobody writes.
    expect(formatDateRange(SAMPLE, '2026-06-30', 'ja')).toBe(
      '2026年6月23日 – 30日',
    )
    expect(formatDateRange(SAMPLE, '2026-06-30', 'hu')).toBe(
      '2026. jún. 23. – 30.',
    )
  })

  it('never leaves an English connector in a non-English range', () => {
    for (const tag of LOCALE_TAGS) {
      if (tag === 'en') {
        continue
      }
      const openStart = formatDateRange(null, '2026-06-30', tag) ?? ''
      const openEnd = formatDateRange(SAMPLE, null, tag) ?? ''
      expect(openStart, tag).not.toMatch(/until/i)
      expect(openEnd, tag).not.toMatch(/from/i)
      expect(openStart, tag).toContain('–')
      expect(openEnd, tag).toContain('–')
    }
  })
})

describe('money, lists and counts in twenty-three languages', () => {
  it('inserts the currency gap only where the symbol is a letter', () => {
    // The Indonesian divergence: workerd separates a letter symbol from the
    // amount and WebKit does not, so the gap is our rule rather than theirs.
    expect(formatMoneyMinor(123450, 'PLN', 'id')).toBe(`zł${NBSP}1.234,50`)
    expect(formatMoneyMinor(123450, 'EUR', 'id')).toBe('€1.234,50')
    expect(formatMoneyMinor(123450, 'EUR', 'de')).toBe(`1.234,50${NBSP}€`)
    expect(formatMoneyMinor(123450, 'EUR', 'sv')).toBe(`1${NBSP}234,50${NBSP}€`)
    // Swedish signs a negative with a real minus, not a hyphen.
    expect(formatMoneyMinor(-123450, 'EUR', 'sv')).toBe(
      `−1${NBSP}234,50${NBSP}€`,
    )
    // The gap follows UTS#35's own test — the character facing the amount is not
    // a *symbol* — rather than "is it a letter": the Belarusian rouble is
    // written `р.` and takes the gap on the strength of its full stop.
    expect(formatMoneyMinor(123450, 'BYN', 'ja')).toBe(`р.${NBSP}1,234.50`)
  })

  it('keeps the bidi mark ICU puts after an Arabic abbreviation', () => {
    // `د.إ.` ends in a bidi-neutral full stop. Without the mark it takes its
    // direction from whatever follows and reads back to front.
    expect(formatMoneyMinor(123450, 'AED', 'ar')).toBe(
      '\u200f1,234.50\u00a0\u062f.\u0625.\u200f',
    )
    // And the currencies ICU does not mark are left unmarked.
    expect(formatMoneyMinor(123450, 'EUR', 'ar')).toBe('\u200f1,234.50\u00a0€')
  })

  it('divides by the minor units the table froze, not the ones Intl guesses', () => {
    // 123450 forint, not 1234.50 of them.
    expect(formatMoneyMinor(123450, 'HUF', 'en')).toBe(`Ft${NBSP}123,450`)
    expect(formatMoneyMinorPlain(123450, 'HUF', 'hu')).toBe(`123${NBSP}450`)
  })

  it('joins a list with the punctuation the language uses', () => {
    expect(formatList(['Anna', 'Iwo', 'Marek'])).toBe('Anna, Iwo and Marek')
    expect(formatList(['Anna', 'Iwo'], 'pl')).toBe('Anna i Iwo')
    expect(formatList(['A', 'B', 'C'], 'ja')).toBe('A、B、C')
    expect(formatList(['A', 'B', 'C'], 'id')).toBe('A, B, dan C')
    // No U+2068/U+2069 isolates, which is what WebKit adds and workerd does not.
    expect(formatList(['A', 'B', 'C'], 'ar')).toBe('A وB وC')
    expect(formatList([], 'en')).toBe('')
    expect(formatList(['Anna'], 'en')).toBe('Anna')
    expect(formatList(['Anna', ''], 'en')).toBe('Anna')
  })

  it('agrees a count through the i18n plural layer, not through count === 1', () => {
    const days = {
      one: 'dzień',
      few: 'dni',
      many: 'dni',
      other: 'dnia',
    }
    expect(pluralise(1, 'pl', days)).toBe('1 dzień')
    expect(pluralise(2, 'pl', days)).toBe('2 dni')
    expect(pluralise(5, 'pl', days)).toBe('5 dni')
    expect(pluralise(22, 'pl', days)).toBe('22 dni')
    // Arabic has categories English does not, and a missing one falls back.
    expect(pluralise(2, 'ar', { one: 'يوم', other: 'أيام' })).toBe('2 أيام')
    expect(pluralise(1000, 'de', { one: 'Tag', other: 'Tage' })).toBe(
      '1.000 Tage',
    )
  })

  it('reads a feed timestamp in the language, with the right plural form', () => {
    const now = Date.parse('2026-06-23T12:00:00.000Z')
    const ago = (ms: number, tag: Locale): string | null =>
      formatRelative(new Date(now - ms).toISOString(), now, tag)

    expect(ago(10_000, 'pl')).toBe('teraz')
    expect(ago(5 * MINUTE, 'pl')).toBe('5 min temu')
    expect(ago(1 * DAY, 'pl')).toBe('1 dzień temu')
    expect(ago(2 * DAY, 'pl')).toBe('2 dni temu')
    // The two the runtimes disagreed about.
    expect(ago(2 * DAY, 'ru')).toBe('2 дн. назад')
    expect(ago(5 * MINUTE, 'zh-Hant')).toBe('5 分鐘前')
    // Beyond a week it is a date again, in the same locale.
    expect(ago(30 * DAY, 'de')).toBe('24. Mai 2026')
  })

  it('numbers and percentages follow the locale', () => {
    expect(formatNumber(1234567, 'de')).toBe('1.234.567')
    expect(formatNumber(1234567, 'fr')).toBe('1 234 567')
    expect(formatPercent(0.42, 'tr')).toBe('%42')
    expect(formatDistance(12_500, 'metric', 'de')).toBe('13 km')
  })

  it('groups a four-digit number by the frozen rule, not the runtime default', () => {
    // Italian, Spanish, Hungarian and Polish leave four digits ungrouped and
    // group from five up; linux WebKit groups the Italian four. These are the
    // bytes workerd renders.
    expect(formatNumber(1000, 'it')).toBe('1000')
    expect(formatNumber(12_345, 'it')).toBe('12.345')
    expect(formatMoneyMinor(123_456, 'EUR', 'it')).toBe(`1234,56${NBSP}€`)
    expect(formatMoneyMinorPlain(123_456, 'EUR', 'it')).toBe('1234,56')
    expect(formatNumber(1000, 'es')).toBe('1000')
    expect(formatNumber(1000, 'hu')).toBe('1000')
    expect(formatNumber(1000, 'pl')).toBe('1000')
    // Everyone else groups from four, and now says so explicitly.
    expect(formatNumber(1000, 'de')).toBe('1.000')
    expect(formatNumber(1000, 'en')).toBe('1,000')
    expect(formatNumber(1000, 'ar')).toBe('1,000')
  })

  it('writes every locale in Latin digits, Arabic included', () => {
    // `ar` is the one shipped locale whose CLDR default numbering system is not
    // `latn`; linux WebKit honours that default and workerd does not.
    expect(formatNumber(101, 'ar')).toBe('101')
    expect(pluralise(101, 'ar', { other: 'other' })).toBe('101 other')
    expect(formatMonthYear('2026-06-01', 'ar')).toContain('2026')
    for (const tag of LOCALE_TAGS) {
      expect(formatNumber(1_234_567, tag).replace(/\D/g, ''), tag).toBe(
        '1234567',
      )
    }
  })
})

describe('the frozen month names against the platform that supplied them', () => {
  const UTC = { timeZone: 'UTC' } as const
  const first = (month: number): Date => new Date(Date.UTC(2026, month, 15))

  /**
   * V8 is workerd's ICU for practical purposes — every field this suite touches
   * was measured identical in the two — so a bare `Intl` call here is a
   * standing drift check against the runtime that renders first. What it cannot
   * see is WebKit; `e2e/i18n-runtime-parity.spec.ts` is where that is measured.
   */
  it('are the standalone form every runtime agrees on, Greek excepted', () => {
    for (const tag of LOCALE_TAGS) {
      if (tag === 'el') {
        continue
      }
      const wide = new Intl.DateTimeFormat(LOCALE_FORMATS[tag].intlLocale, {
        ...UTC,
        month: 'long',
      })
      const narrow = new Intl.DateTimeFormat(LOCALE_FORMATS[tag].intlLocale, {
        ...UTC,
        month: 'short',
      })
      for (let month = 0; month < 12; month += 1) {
        expect(monthName(month, tag, 'long'), `${tag} ${month}`).toBe(
          wide.format(first(month)),
        )
        expect(monthName(month, tag, 'short'), `${tag} ${month}`).toBe(
          narrow.format(first(month)),
        )
      }
    }
  })

  it('take the Greek nominative, which only the composed form yields here', () => {
    // Greek is the one locale whose bare `{ month: 'long' }` differs between
    // the runtimes: workerd and this V8 answer the genitive that belongs inside
    // a date, WebKit the nominative that belongs over a column. The nominative
    // is the label, and all three runtimes produce it in the month-and-year
    // context — which is why the frozen value matches that and not the call
    // above.
    const bare = new Intl.DateTimeFormat(LOCALE_FORMATS.el.intlLocale, {
      ...UTC,
      month: 'long',
    })
    const composed = new Intl.DateTimeFormat(LOCALE_FORMATS.el.intlLocale, {
      ...UTC,
      month: 'long',
      year: 'numeric',
    })
    for (let month = 0; month < 12; month += 1) {
      const nominative = composed
        .formatToParts(first(month))
        .find((part) => part.type === 'month')?.value
      expect(monthName(month, 'el', 'long'), `el ${month}`).toBe(nominative)
      expect(monthName(month, 'el', 'long'), `el ${month}`).not.toBe(
        bare.format(first(month)),
      )
    }
  })

  it('leave the month-and-year form live, and naming twelve distinct months', () => {
    // `{ month: 'long', year: 'numeric' }` is one of the three fields kept live,
    // because all three runtimes composed it identically for all twenty-three
    // locales — the parity spec re-proves that in WebKit on every run. What is
    // checked here is that it is pinned to UTC and to the locale's own tag: a
    // month that leaks the machine's timezone lands on the wrong side of a
    // month boundary, and twelve calls must name twelve different months.
    for (const tag of LOCALE_TAGS) {
      const seen = new Set<string>()
      for (let month = 0; month < 12; month += 1) {
        const iso = `2026-${String(month + 1).padStart(2, '0')}-01`
        const composed = formatMonthYear(iso, tag) ?? ''
        expect(composed, `${tag} ${iso}`).toContain('2026')
        seen.add(composed)
      }
      expect(seen.size, tag).toBe(12)
    }
  })
})

/**
 * `Intl.DisplayNames` is banned across `src/lib` for the reason
 * `src/lib/i18n/locales.ts` documents at length: workerd returns CLDR's
 * lower-case forms, the WebKit that Safari ships title-cases eight of the
 * twenty-three, and a name that differs between the server pass and the client
 * pass is a hydration error. `src/lib/i18n/__tests__/source-rules.test.ts` greps
 * one directory; the formatter lives outside it, and so do the atlas tables, so
 * the ban is checked over the whole of `src/lib` here.
 */
describe('the shipped source under src/lib', () => {
  const LIB = join(process.cwd(), 'src', 'lib')
  const COMMENT = /^\s*(\/\/|\/\*|\*)/

  function sources(directory: string): Array<string> {
    const found: Array<string> = []
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') {
          found.push(...sources(path))
        }
        continue
      }
      if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        found.push(path)
      }
    }
    return found
  }

  const files = sources(LIB)

  it('covers the formatter, so the grep below means something', () => {
    expect(files).toContain(join(LIB, 'format.ts'))
    expect(files).toContain(join(LIB, 'format-tables.ts'))
    expect(files.length).toBeGreaterThan(10)
  })

  it('never hands a bare locale tag to Intl in the formatter', () => {
    // `Intl` reads its numbering system and its grouping rule out of whichever
    // ICU the runtime was built against, and the two runtimes answer
    // differently for `ar` and `it`. The frozen `intlLocale` carries the
    // `-u-nu-latn` extension that settles the first; passing a bare `locale`
    // instead quietly reopens the divergence, and only in Safari.
    //
    // The locale argument is read off the joined source rather than line by
    // line, so that a call prettier wraps across two lines is still checked
    // rather than silently excused.
    const source = readFileSync(join(LIB, 'format.ts'), 'utf8')
      .split('\n')
      .filter((line) => !COMMENT.test(line))
      .join(' ')
    const offenders = [...source.matchAll(/new Intl\.\w+\(([^,]*)/g)]
      .filter((call) => !call[1].includes('intlLocale'))
      .map((call) => call[0])
    expect(
      offenders,
      'every Intl instance takes the frozen tag from LOCALE_FORMATS, never the Locale itself',
    ).toEqual([])
  })

  /**
   * The three literals in `src/lib` that no reader ever sees.
   *
   * `time.ts` hands `en-GB` to `Intl` to find out whether a time-zone name is
   * one the runtime knows, and throws the formatter away without formatting
   * anything. It picks `en-CA` for the cache key because that locale's numeric
   * date format is already `YYYY-MM-DD`, so the key needs no reassembly from
   * parts. `timezones.ts` picks `en-CA` for the same reason and for a stronger
   * one: it reads *numeric* parts to derive a zone's offset arithmetically,
   * because `timeZoneName: 'shortOffset'` resolves its names from the engine's
   * own ICU build and workerd and WebKit do not always agree. None of the three
   * reaches a screen; all three would be wrong as a reader's locale, and that
   * is the point.
   */
  const PINNED_BY_DESIGN: ReadonlyArray<string> = [
    'time.ts: en-GB',
    'time.ts: en-CA',
    'timezones.ts: en-CA',
  ]

  it('never pins a locale tag as a literal', () => {
    // The defect this pins: `money.ts` held `const LOCALE = 'en-GB'` and every
    // amount in the costs module went through it, so a Polish reader's balance
    // said `£2,384.00` where their own conventions say `2384,00 £`. The rule
    // above checks the *shape* of the argument handed to `Intl`; this one checks
    // that a locale is never decided here at all. The frozen tags in
    // `format-tables.ts` are the one exception, and they are the table itself.
    const offenders: Array<string> = []
    for (const path of files) {
      if (path.endsWith('format-tables.ts')) {
        continue
      }
      const source = readFileSync(path, 'utf8')
        .split('\n')
        .filter((line) => !COMMENT.test(line))
        .join(' ')
      for (const call of source.matchAll(/new Intl\.\w+\(\s*'([\w-]+)'/g)) {
        offenders.push(`${path.split('/').at(-1)}: ${call[1]}`)
      }
    }
    // A list rather than a set: a second pin with a tag already on it makes the
    // list longer and fails, which a set would absorb.
    expect(
      offenders.sort(),
      'a locale belongs to the reader; pass it in rather than choosing one here',
    ).toEqual([...PINNED_BY_DESIGN].sort())
  })

  it('never calls Intl.DisplayNames', () => {
    const offenders = files.filter((path) =>
      readFileSync(path, 'utf8')
        .split('\n')
        .filter((line) => !COMMENT.test(line))
        .some((line) => line.includes('Intl.DisplayNames')),
    )
    expect(
      offenders,
      'language and region names differ between workerd and WebKit; use the frozen tables in lib/i18n/locales.ts and lib/atlas/country-names.ts',
    ).toEqual([])
  })
})

afterEach(() => {
  // The formatter caches `Intl` instances per locale at module scope, and a test
  // that swaps `Intl.DateTimeFormat` out must not leave a stubbed instance
  // behind it. Constructing one here proves the real constructor is back.
  expect(typeof Intl.DateTimeFormat).toBe('function')
})

/**
 * Every money and day figure on a screen carries the reader's locale.
 *
 * The five formatters in `src/lib/money.ts` and the two day helpers in
 * `src/components/costs/data.ts` all default their locale to `en`, so that the
 * signature could change without thirty-seven call sites changing in the same
 * commit. The cost of that default is that a call which forgets the argument
 * compiles, runs, and prints English at a Polish reader — invisible to the type
 * checker, and invisible on an English screen, which is the only screen a
 * developer usually looks at.
 *
 * So the argument is required by a rule instead. The default stays for the
 * places that genuinely have no reader: a CSV export, a test, a server function.
 */
describe('every rendered figure takes a locale', () => {
  const ROOTS = [
    join(process.cwd(), 'src', 'components'),
    join(process.cwd(), 'src', 'routes'),
  ]
  const COMMENT_LINE = /^\s*(\/\/|\/\*|\*)/
  /**
   * Every export of `format.ts` and `money.ts` whose output a reader sees and
   * whose locale defaults. `formatTime` and `formatTimeRange` are absent because
   * they slice `HH:MM` off a stored string and take no locale at all.
   */
  const FORMATTERS = [
    'formatMoney',
    'formatMoneyPlain',
    'formatSignedMoney',
    'formatConversion',
    'formatExchangeRate',
    'formatDayLabel',
    'formatDayShort',
    'groupByDay',
    'formatDate',
    'formatDayMonth',
    'formatWeekday',
    'formatMonthYear',
    'formatDateRange',
    'formatNumber',
    'formatAbsolute',
    'formatRate',
    'formatMoneyMinor',
    'formatMoneyMinorPlain',
    'formatPrice',
    'formatPercent',
    'formatRelative',
    'formatList',
  ]

  /**
   * A CSV is read by a spreadsheet, not by a person: a grouped amount with a
   * comma decimal inside a comma-separated field is a data contract, and
   * changing it is not a copy fix. `expensesCsv` keeps the default on purpose.
   */
  const EXEMPT: ReadonlyArray<string> = ['costs/data.ts']

  function walk(directory: string): Array<string> {
    const found: Array<string> = []
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') {
          found.push(...walk(path))
        }
        continue
      }
      if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        found.push(path)
      }
    }
    return found
  }

  const files = ROOTS.flatMap(walk)

  /** The balanced argument text of a call starting just past its open paren. */
  function argumentsOf(source: string, from: number): string {
    let depth = 1
    let index = from
    while (index < source.length && depth > 0) {
      const char = source[index]
      if (char === '(' || char === '[' || char === '{') depth += 1
      else if (char === ')' || char === ']' || char === '}') depth -= 1
      index += 1
    }
    return source.slice(from, index - 1)
  }

  it('reads the files the rule is about, so the scan means something', () => {
    const names = files.map((path) => path.split('/').at(-1))
    expect(names).toContain('split-editor.tsx')
    expect(names).toContain('stat-tiles.tsx')
    expect(files.length).toBeGreaterThan(100)
  })

  it.each(FORMATTERS)('never calls %s without one', (name) => {
    const offenders: Array<string> = []
    for (const path of files) {
      if (EXEMPT.some((tail) => path.endsWith(tail))) {
        continue
      }
      const source = readFileSync(path, 'utf8')
        .split('\n')
        .filter((line) => !COMMENT_LINE.test(line))
        .join(' ')
      const needle = `${name}(`
      let at = source.indexOf(needle)
      while (at >= 0) {
        const before = at === 0 ? ' ' : source[at - 1]
        // A property access or a longer identifier ending in this name is a
        // different function; `formatMoneyPlain` must not match `formatMoney`.
        if (!/[\w.$]/.test(before)) {
          const args = argumentsOf(source, at + needle.length)
          if (!/\blocale\b/.test(args)) {
            offenders.push(
              `${path.split('/').slice(-2).join('/')}: ${name}(${args.slice(0, 40)})`,
            )
          }
        }
        at = source.indexOf(needle, at + 1)
      }
    }
    expect(
      offenders,
      `${name} decides how a number reads; the reader decides the locale`,
    ).toEqual([])
  })
})

describe('formatYear', () => {
  it.each(['en', 'de', 'ar'] as const)(
    'prints Latin years without grouping in %s',
    async (locale) => {
      const { formatYear } = await import('../format')
      expect(formatYear(2027, locale)).toBe('2027')
    },
  )
})
