import { describe, expect, it } from 'vitest'

import { formatStorageSize } from '../storage-size'

/**
 * The claim under test is criterion-shaped: a figure a reader sees is punctuated
 * the way their locale punctuates a figure. `formatStorage` in
 * `src/lib/plans.ts` built its string with a template literal, so the decimal
 * point stayed ASCII on every screen in all twenty-three languages — a German
 * reader saw `5.2 GB` where German writes `5,2`.
 *
 * `ar` is here because it is the locale most likely to be asserted wrongly: the
 * bare tag carries the `latn` numbering system, so Arabic renders `1,024` and
 * never Arabic-Indic digits, which belong to tags we do not ship.
 */

/**
 * The gap between figure and symbol is an ordinary U+0020, because `StatCard`
 * peels a short trailing abbreviation off a value with a pattern that matches
 * that character and not U+00A0 — a no-break space would cost the admin
 * console's storage tile its typographic split without failing anything.
 */
const GAP = ' '

describe('a byte count is punctuated for the reader', () => {
  it('steps through the binary units', () => {
    expect(formatStorageSize(0, 'en')).toBe(`0${GAP}B`)
    expect(formatStorageSize(512, 'en')).toBe(`512${GAP}B`)
    expect(formatStorageSize(1024, 'en')).toBe(`1${GAP}KB`)
    expect(formatStorageSize(104_857_600, 'en')).toBe(`100${GAP}MB`)
    expect(formatStorageSize(1024 ** 4, 'en')).toBe(`1${GAP}TB`)
  })

  it('stops at the largest unit rather than inventing one', () => {
    expect(formatStorageSize(1024 ** 5, 'en')).toBe(`1,024${GAP}TB`)
  })

  it('punctuates the decimal the way the locale does', () => {
    const bytes = 5.2 * 1024 ** 3
    expect(formatStorageSize(bytes, 'en')).toBe(`5.2${GAP}GB`)
    expect(formatStorageSize(bytes, 'de')).toBe(`5,2${GAP}GB`)
    expect(formatStorageSize(bytes, 'pl')).toBe(`5,2${GAP}GB`)
  })

  it('groups a large figure the way the locale groups', () => {
    expect(formatStorageSize(1024 ** 5 * 2.5, 'en')).toBe(`2,560${GAP}TB`)
    expect(formatStorageSize(1024 ** 5 * 2.5, 'de')).toBe(`2.560${GAP}TB`)
  })

  it('renders Arabic in Latin digits, because `ar` carries `latn`', () => {
    expect(formatStorageSize(1024 ** 2 * 1024, 'ar')).toBe(`1${GAP}GB`)
    expect(formatStorageSize(1024 ** 4 * 1024, 'ar')).toBe(`1,024${GAP}TB`)
  })

  it('shows one decimal below a hundred and none at or above it', () => {
    expect(formatStorageSize(1024 * 1.25, 'en')).toBe(`1.3${GAP}KB`)
    expect(formatStorageSize(1024 * 99.94, 'en')).toBe(`99.9${GAP}KB`)
    expect(formatStorageSize(1024 * 100.4, 'en')).toBe(`100${GAP}KB`)
  })

  it('never shows a fraction of a byte', () => {
    expect(formatStorageSize(3.7, 'en')).toBe(`4${GAP}B`)
  })

  it('treats a negative figure as nothing stored', () => {
    expect(formatStorageSize(-1, 'en')).toBe(`0${GAP}B`)
  })
})
