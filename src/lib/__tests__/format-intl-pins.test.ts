import { afterEach, describe, expect, it, vi } from 'vitest'

import { LOCALE_TAGS } from '#/lib/i18n'
import type { Locale } from '#/lib/i18n'
import { LOCALE_FORMATS } from '../format-tables'
import * as realFormat from '../format'

/**
 * The two `Intl` defaults `format.ts` refuses to leave to the runtime: the
 * numbering system, pinned by the `-u-nu-latn` extension on every frozen
 * `intlLocale`, and the CLDR grouping rule, handed to every `Intl.NumberFormat`
 * as `useGrouping`.
 *
 * `format-locale.test.ts` pins the *table* — the extension is on all twenty-three
 * tags, the `min2` roster is `es`, `hu`, `it`, `pl` — and the source rule there
 * catches a call that takes a bare `Locale`. None of that notices the regression
 * this file exists for: delete `useGrouping` from `makeNumberFormat` and every
 * case in the suite stays green, because V8 already answers `latn` for `ar` and
 * already honours `minimumGroupingDigits=2`. Only `e2e/i18n-runtime-parity.spec.ts`
 * went red — in the linux WebKit the Playwright container ships, which is the
 * most expensive check in the repo and the one furthest from the edit.
 *
 * So the pins are guarded here in the two ways a Node-hosted suite can guard
 * them:
 *
 * 1. By reading the options the formatters were actually constructed with —
 *    `resolvedOptions()` on each instance `format.ts` builds — rather than the
 *    bytes they happened to produce on this ICU.
 * 2. By running the formatter against a substitute `Intl` that diverges the way
 *    the linux WebKit did, and holding its output to the byte against what this
 *    runtime (V8, workerd's ICU for practical purposes) writes. A pin that is
 *    still passed survives the substitution; one that is gone does not.
 */

/** The formatter module, however it was loaded. */
type Formatter = typeof realFormat

const REAL_NUMBER_FORMAT = Intl.NumberFormat
const REAL_DATE_TIME_FORMAT = Intl.DateTimeFormat

/** The gap UTS#35 puts between an amount and a letter-facing currency symbol. */
const NBSP = '\u00a0'

/** Arabic-Indic and extended Arabic-Indic digits — the `arab` numbering system. */
const ARABIC_INDIC = /[٠-٩۰-۹]/

function substitute(
  name: 'NumberFormat' | 'DateTimeFormat',
  value: unknown,
): void {
  Object.defineProperty(Intl, name, { configurable: true, value })
}

/**
 * A copy of the formatter with its module-scope `Intl` caches empty, so the
 * instances it builds are built against whichever constructors are installed
 * now rather than reused from an earlier test.
 */
async function freshFormatter(): Promise<Formatter> {
  vi.resetModules()
  return import('../format')
}

/** Every number-bearing string one locale can produce, in one object. */
function probe(format: Formatter, tag: Locale): Record<string, string> {
  return {
    thousand: format.formatNumber(1000, tag),
    hundredAndOne: format.formatNumber(101, tag),
    million: format.formatNumber(1_234_567, tag),
    percent: format.formatPercent(0.42, tag),
    money: format.formatMoneyMinor(123_456, 'EUR', tag),
    plain: format.formatMoneyMinorPlain(123_456, 'EUR', tag),
    distance: format.formatDistance(12_500, 'metric', tag),
    monthYear: format.formatMonthYear('2026-06-01', tag) ?? '',
    count: format.pluralise(101, tag, { other: 'x' }),
  }
}

afterEach(() => {
  substitute('NumberFormat', REAL_NUMBER_FORMAT)
  substitute('DateTimeFormat', REAL_DATE_TIME_FORMAT)
  vi.resetModules()
  expect(Intl.NumberFormat).toBe(REAL_NUMBER_FORMAT)
  expect(Intl.DateTimeFormat).toBe(REAL_DATE_TIME_FORMAT)
})

describe('the options every Intl instance the formatter builds is given', () => {
  type Construction = {
    readonly locales: unknown
    readonly options: Intl.NumberFormatOptions | undefined
    readonly resolved: Intl.ResolvedNumberFormatOptions
  }

  const numbers: Array<Construction> = []
  const dates: Array<unknown> = []

  class RecordingNumberFormat extends REAL_NUMBER_FORMAT {
    constructor(
      locales?: Intl.LocalesArgument,
      options?: Intl.NumberFormatOptions,
    ) {
      super(locales, options)
      numbers.push({ locales, options, resolved: this.resolvedOptions() })
    }
  }

  class RecordingDateTimeFormat extends REAL_DATE_TIME_FORMAT {
    constructor(
      locales?: Intl.LocalesArgument,
      options?: Intl.DateTimeFormatOptions,
    ) {
      super(locales, options)
      dates.push(locales)
    }
  }

  async function record(tag: Locale): Promise<void> {
    numbers.length = 0
    dates.length = 0
    substitute('NumberFormat', RecordingNumberFormat)
    substitute('DateTimeFormat', RecordingDateTimeFormat)
    const format = await freshFormatter()
    probe(format, tag)
  }

  it('carries the frozen row into every number formatter, for every locale', async () => {
    for (const tag of LOCALE_TAGS) {
      const row = LOCALE_FORMATS[tag]
      await record(tag)

      // The four `Intl.NumberFormat`s the module builds: the decimal one, the
      // percent one, the fixed-digit money one and the currency-symbol probe.
      // Fewer than four means a formatter stopped being built at all; a fifth
      // that skipped `makeNumberFormat` would fail the assertions below.
      expect(numbers.length, tag).toBeGreaterThanOrEqual(4)
      expect(
        numbers.map((call) => call.options?.style ?? 'decimal'),
        tag,
      ).toEqual(expect.arrayContaining(['decimal', 'percent', 'currency']))

      for (const call of numbers) {
        const where = `${tag} ${call.options?.style ?? 'decimal'}`
        expect(call.locales, where).toBe(row.intlLocale)
        // Asked for, never inherited: this is the assertion that goes red the
        // moment `makeNumberFormat` stops handing the row's rule over.
        expect(call.options?.useGrouping, where).toBe(row.grouping)
        expect(call.resolved.useGrouping, where).toBe(row.grouping)
        expect(call.resolved.numberingSystem, where).toBe('latn')
      }

      // `formatMonthYear` is the one date form still composed by `Intl`, and it
      // prints a year: it takes the same pinned tag rather than the bare locale.
      expect(dates, tag).not.toHaveLength(0)
      for (const locales of dates) {
        expect(locales, tag).toBe(row.intlLocale)
      }
    }
  })
})

describe('a runtime that reads its own ICU, the way linux WebKit does', () => {
  /**
   * The substitute. It reproduces exactly the two divergences #58 measured in
   * the WebKit the Playwright container ships, and nothing else:
   *
   * - a locale that does not name a numbering system resolves `ar` to `arab`,
   *   so `101` comes back as `١٠١`;
   * - a formatter that is not told a grouping rule groups from four digits up,
   *   ignoring CLDR's `minimumGroupingDigits=2`.
   *
   * Both are defaults, so both vanish the moment the frozen row is handed over —
   * which is what makes this a test of the pins rather than of ICU.
   */
  function diverge(locales: Intl.LocalesArgument): Intl.LocalesArgument {
    return typeof locales === 'string' &&
      /^ar\b/.test(locales) &&
      !locales.includes('-nu-')
      ? `${locales}-u-nu-arab`
      : locales
  }

  class DivergentNumberFormat extends REAL_NUMBER_FORMAT {
    constructor(
      locales?: Intl.LocalesArgument,
      options?: Intl.NumberFormatOptions,
    ) {
      super(diverge(locales), {
        ...options,
        useGrouping: options?.useGrouping ?? 'always',
      })
    }
  }

  class DivergentDateTimeFormat extends REAL_DATE_TIME_FORMAT {
    constructor(
      locales?: Intl.LocalesArgument,
      options?: Intl.DateTimeFormatOptions,
    ) {
      super(diverge(locales), options)
    }
  }

  async function divergentFormatter(): Promise<Formatter> {
    substitute('NumberFormat', DivergentNumberFormat)
    substitute('DateTimeFormat', DivergentDateTimeFormat)
    return freshFormatter()
  }

  it('renders every locale byte-for-byte as this runtime does', async () => {
    // The baseline is taken first and on the real constructors: these are the
    // bytes workerd writes, and the ones the browser has to hydrate.
    const expected = new Map(
      LOCALE_TAGS.map((tag) => [tag, probe(realFormat, tag)] as const),
    )
    const format = await divergentFormatter()
    for (const tag of LOCALE_TAGS) {
      expect(probe(format, tag), tag).toEqual(expected.get(tag))
    }
  })

  it('writes Arabic in Latin digits, because the tag says so', async () => {
    const format = await divergentFormatter()
    expect(format.formatNumber(101, 'ar')).toBe('101')
    expect(format.formatNumber(1_234_567, 'ar')).toBe('1,234,567')
    expect(format.formatPercent(0.42, 'ar')).toContain('42')
    expect(format.pluralise(101, 'ar', { other: 'عناصر' })).toBe('101 عناصر')
    expect(format.formatDistance(12_500, 'metric', 'ar')).toBe('13 km')
    expect(format.formatMonthYear('2026-06-01', 'ar')).toContain('2026')
    for (const value of Object.values(probe(format, 'ar'))) {
      expect(value, value).not.toMatch(ARABIC_INDIC)
    }
    // And the substitute is not a no-op: asked without the extension, it
    // resolves `ar` the way the container's WebKit did — which is the whole
    // reason the frozen tag carries one.
    expect(new Intl.NumberFormat('ar').format(101)).toBe('١٠١')
  })

  it('leaves a four-digit number ungrouped where CLDR says min2', async () => {
    const format = await divergentFormatter()
    for (const tag of ['es', 'hu', 'it', 'pl'] as const) {
      expect(LOCALE_FORMATS[tag].grouping, tag).toBe('min2')
      expect(format.formatNumber(1000, tag), tag).toBe('1000')
      // Five digits is where a min2 locale does group.
      expect(format.formatNumber(10_000, tag), tag).not.toBe('10000')
    }
    expect(format.formatNumber(12_345, 'it')).toBe('12.345')
    expect(format.formatMoneyMinor(123_456, 'EUR', 'it')).toBe(
      `1234,56${NBSP}€`,
    )
    expect(format.formatMoneyMinorPlain(123_456, 'EUR', 'it')).toBe('1234,56')
    // The locales CLDR groups from four up are asked for just as explicitly,
    // and the substitute must not move them either.
    expect(format.formatNumber(1000, 'de')).toBe('1.000')
    expect(format.formatNumber(1000, 'en')).toBe('1,000')
    // Not a no-op here either: unasked, the substitute groups the Italian
    // four digits, where V8 and workerd honour `minimumGroupingDigits=2`.
    expect(new Intl.NumberFormat('it').format(1000)).toBe('1.000')
  })
})
