/**
 * The visit span, said in the reader's language.
 *
 * `#/lib/atlas/visit-span` decides the *shape* of a country's two day columns —
 * one date, two dates, one end recorded, or neither — and it is the only place
 * that decision is made. What it also carries is English prose: `label`, `gap`
 * and `summary` are written in the source locale, because it predates the
 * catalogue and is shared with surfaces this item does not own.
 *
 * So this module takes the shape and leaves the prose. Every function below
 * reads only the structural half — `kind`, `edge`, the `iso` strings and the
 * whole-day `days` count — and composes the sentence from `messages/en/atlas.ts`
 * with `formatDate()` from the product's single, frozen formatter. Nothing here
 * asks the platform to name a month, and nothing here re-implements the shape
 * decision: a second opinion about when a country has "one date" rather than
 * "two the same" is exactly the drift the union was introduced to stop.
 *
 * The three surfaces that render a span — the country record, a list row and
 * the atlas write block — share these functions, so a country reads the same
 * way wherever the reader meets it.
 */

import { formatDate, formatNumber } from '#/lib/format'

import type { Locale, Translate } from '#/lib/i18n'
import type { VisitSpan } from '#/lib/atlas/visit-span'

/** Average days per Gregorian month and year, for the "how far apart" line. */
const DAYS_PER_MONTH = 30.436875
const DAYS_PER_YEAR = 365.2425

/** One labelled date, machine-readable wherever a real day exists. */
export interface VisitCell {
  /** The heading over the value. */
  readonly label: string
  /** The value as printed — a date, or the words that stand in for one. */
  readonly value: string
  /** `YYYY-MM-DD` for a `<time>`, or `null` when the cell carries words. */
  readonly iso: string | null
}

/** One end of the span, formatted for this locale. */
function day(iso: string, t: Translate, locale: Locale): string {
  // The span's own `iso` is already the canonical `YYYY-MM-DD` it parsed, so a
  // null answer here is unreachable in practice; the fallback keeps the return
  // type honest rather than reaching for a non-null assertion.
  return formatDate(iso, locale) ?? t('atlas.record.notRecorded')
}

/**
 * The span's four shapes as labelled cells.
 *
 * A single visit is one cell: two cells holding the same day under "first" and
 * "last" reads as a bug, and it is the majority case on a real record.
 */
export function visitCells(
  span: VisitSpan,
  t: Translate,
  locale: Locale,
): ReadonlyArray<VisitCell> {
  switch (span.kind) {
    case 'single':
      return [
        {
          label: t('atlas.record.visited'),
          value: day(span.date.iso, t, locale),
          iso: span.date.iso,
        },
      ]
    case 'range':
      return [
        {
          label: t('atlas.record.firstVisit'),
          value: day(span.first.iso, t, locale),
          iso: span.first.iso,
        },
        {
          label: t('atlas.record.lastVisit'),
          value: day(span.last.iso, t, locale),
          iso: span.last.iso,
        },
      ]
    case 'partial': {
      const known: VisitCell = {
        label:
          span.edge === 'first'
            ? t('atlas.record.firstVisit')
            : t('atlas.record.lastVisit'),
        value: day(span.date.iso, t, locale),
        iso: span.date.iso,
      }
      const missing: VisitCell = {
        label:
          span.edge === 'first'
            ? t('atlas.record.lastVisit')
            : t('atlas.record.firstVisit'),
        value: t('atlas.record.notRecorded'),
        iso: null,
      }
      return span.edge === 'first' ? [known, missing] : [missing, known]
    }
    case 'unrecorded':
      return [
        {
          label: t('atlas.record.visitDates'),
          value: t('atlas.record.datesUnrecorded'),
          iso: null,
        },
      ]
  }
}

/**
 * How far apart the two ends of a range are, in the coarsest unit still true.
 *
 * Days below two months, because "58 days apart" is a fact a traveller
 * recognises; months below two years; whole years after that, where a decimal
 * would be false precision against a date the reader can already see.
 */
export function visitGap(days: number, t: Translate, locale: Locale): string {
  if (days < 60) {
    return t('atlas.record.gap.days', {
      count: days,
      gap: formatNumber(days, locale),
    })
  }
  const months = Math.round(days / DAYS_PER_MONTH)
  if (months < 24) {
    return t('atlas.record.gap.months', {
      count: months,
      gap: formatNumber(months, locale),
    })
  }
  const years = Math.round(days / DAYS_PER_YEAR)
  return t('atlas.record.gap.years', {
    count: years,
    gap: formatNumber(years, locale),
  })
}

/**
 * The recorded days on one line, for a caption that has already said what it is
 * about.
 *
 * Deliberately bare: the single-day case is the date alone, because the row
 * above it is already headed "Visited" and a second "Visited" inside the
 * caption says nothing. An unrecorded span gets words rather than an empty
 * string, since a blank in a value slot reads as a rendering failure.
 */
export function visitLine(
  span: VisitSpan,
  t: Translate,
  locale: Locale,
): string {
  switch (span.kind) {
    case 'single':
      return day(span.date.iso, t, locale)
    case 'range':
      return t('atlas.record.span', {
        from: day(span.first.iso, t, locale),
        to: day(span.last.iso, t, locale),
      })
    case 'partial':
      return span.edge === 'first'
        ? t('atlas.record.spanFrom', { from: day(span.date.iso, t, locale) })
        : t('atlas.record.spanTo', { to: day(span.date.iso, t, locale) })
    case 'unrecorded':
      return t('atlas.record.datesUnrecorded')
  }
}
