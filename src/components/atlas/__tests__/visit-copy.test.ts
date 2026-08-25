import { describe, expect, it } from 'vitest'

import { DEFAULT_LOCALE, createTranslator } from '#/lib/i18n'
import source from '#/lib/i18n/messages/en/atlas'
import { visitSpan } from '#/lib/atlas/visit-span'
import { continentLabel, continentLabelOrUnknown } from '../continent'
import { visitCells, visitGap, visitLine } from '../visit-copy'

import type { Catalogue, Locale } from '#/lib/i18n'

/**
 * The two helpers that stand between the atlas and its prose.
 *
 * `#/lib/atlas/visit-span` decides the *shape* of a country's two day columns
 * and carries English `label`, `gap` and `summary` strings that predate the
 * catalogue. These functions take the shape and leave the prose, so the checks
 * below are about exactly that seam: the right number of cells for each shape,
 * the right heading on each one, and a date that came from
 * `src/lib/format.ts` in the reader's locale rather than from the span.
 */

/** The source catalogue bound the way `useAtlasI18n()` binds it with no provider. */
const catalogue = Object.fromEntries(
  Object.entries(source).map(([key, message]) => [`atlas.${key}`, message]),
)

const t = createTranslator(DEFAULT_LOCALE, catalogue)

/**
 * The same translator with a handful of keys replaced, so the tests below can
 * prove a value came *out of the catalogue* rather than off the span. The
 * twenty-two translations are owned by the translation items, so there is no
 * shipped non-English atlas catalogue to read here yet.
 */
function stubbed(overrides: Catalogue, locale: Locale = DEFAULT_LOCALE) {
  return createTranslator(locale, { ...catalogue, ...overrides })
}

describe('visitCells', () => {
  it('prints one cell for a country visited on one recorded day', () => {
    const cells = visitCells(visitSpan('2011-07-14', '2011-07-14'), t, 'en')
    expect(cells).toEqual([
      { label: 'Visited', value: '14 Jul 2011', iso: '2011-07-14' },
    ])
  })

  it('prints both ends of a real range, whole', () => {
    const cells = visitCells(visitSpan('2011-07-14', '2020-01-03'), t, 'en')
    expect(cells.map((cell) => cell.label)).toEqual([
      'First visit',
      'Last visit',
    ])
    expect(cells.map((cell) => cell.value)).toEqual([
      '14 Jul 2011',
      '3 Jan 2020',
    ])
  })

  it('keeps a half-recorded pair honest about the missing end', () => {
    const opened = visitCells(visitSpan('2011-07-14', null), t, 'en')
    expect(opened.map((cell) => [cell.label, cell.value])).toEqual([
      ['First visit', '14 Jul 2011'],
      ['Last visit', 'Not recorded'],
    ])

    const closed = visitCells(visitSpan(null, '2011-07-14'), t, 'en')
    expect(closed.map((cell) => [cell.label, cell.value])).toEqual([
      ['First visit', 'Not recorded'],
      ['Last visit', '14 Jul 2011'],
    ])
  })

  it('gives an unrecorded pair words rather than an empty dash', () => {
    expect(visitCells(visitSpan(null, null), t, 'en')).toEqual([
      { label: 'Visit dates', value: 'Dates not recorded', iso: null },
    ])
  })

  /**
   * The whole reason these helpers exist: the span's own `label` is pinned to
   * the source locale, and a German record has to read a German date.
   */
  it('formats the date in the reader locale, not the span’s', () => {
    // `visitSpan` renders `14 Sept 2011` in the source locale and hands it over
    // as `label`; nothing here reads that field. September is the month the
    // frozen tables exist for — workerd said `Sept` where WebKit said `Sep`.
    const [cell] = visitCells(visitSpan('2011-09-14', null), t, 'de')
    expect(cell.value).toBe('14. Sept. 2011')

    const heading = stubbed({ 'atlas.record.firstVisit': 'Erster Besuch' })
    const [translated] = visitCells(
      visitSpan('2011-09-14', null),
      heading,
      'de',
    )
    expect(translated.label).toBe('Erster Besuch')
  })
})

describe('visitGap', () => {
  it('counts days below two months', () => {
    expect(visitGap(1, t, 'en')).toBe('1 day apart')
    expect(visitGap(59, t, 'en')).toBe('59 days apart')
  })

  it('coarsens to months, then to whole years', () => {
    expect(visitGap(61, t, 'en')).toBe('2 months apart')
    expect(visitGap(365 * 13, t, 'en')).toBe('13 years apart')
  })

  it('groups the figure for the locale it is printed in', () => {
    // The number a reader sees goes through the formatter, never through raw
    // substitution: German groups on a full stop where English uses a comma.
    const de = stubbed(
      {
        'atlas.record.gap.years': {
          one: '{gap} Jahr auseinander',
          other: '{gap} Jahre auseinander',
        },
      },
      'de',
    )
    expect(visitGap(1_095_728, de, 'de')).toBe('3.000 Jahre auseinander')
  })
})

describe('visitLine', () => {
  it('says the single day alone, under a row already headed “Visited”', () => {
    expect(visitLine(visitSpan('2011-07-14', '2011-07-14'), t, 'en')).toBe(
      '14 Jul 2011',
    )
  })

  it('joins a range with the locale’s own dash', () => {
    expect(visitLine(visitSpan('2011-07-14', '2020-01-03'), t, 'en')).toBe(
      '14 Jul 2011 – 3 Jan 2020',
    )
  })

  it('names which end a half-recorded pair actually has', () => {
    expect(visitLine(visitSpan('2011-07-14', null), t, 'en')).toBe(
      'First visit 14 Jul 2011',
    )
    expect(visitLine(visitSpan(null, '2011-07-14'), t, 'en')).toBe(
      'Last visit 14 Jul 2011',
    )
  })

  it('has words for a country with no dates at all', () => {
    expect(visitLine(visitSpan(null, null), t, 'en')).toBe('Dates not recorded')
  })
})

describe('continentLabel', () => {
  it('reads the seven the product itself writes out of the catalogue', () => {
    const de = stubbed({
      'atlas.continent.northAmerica': 'Nordamerika',
      'atlas.continent.antarctica': 'Antarktis',
    })
    expect(continentLabel('North America', de)).toBe('Nordamerika')
    expect(continentLabel('Antarctica', de)).toBe('Antarktis')
  })

  it('folds case and spacing, because the column is free text', () => {
    expect(continentLabel('north america', t)).toBe('North America')
    expect(continentLabel('  EUROPE  ', t)).toBe('Europe')
  })

  it('keeps a value the seven do not cover rather than dropping it', () => {
    expect(continentLabel('macaronesia', t)).toBe('Macaronesia')
  })

  it('separates “no continent recorded” from “we do not know which”', () => {
    expect(continentLabel('', t)).toBeNull()
    expect(continentLabel('   ', t)).toBeNull()
    expect(continentLabel(null, t)).toBeNull()
    expect(continentLabelOrUnknown(null, t)).toBe('Continent not recorded')
  })
})
