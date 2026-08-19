/**
 * The shape of "first visit" and "last visit" as a reader should meet them.
 *
 * A visited country carries two nullable day columns, and the naive rendering,
 * two labelled cells printed side by side, is wrong for most rows. In our own
 * seed eight countries of twelve were visited exactly once, so a template that
 * always prints a range prints the same date twice, under two different
 * headings, on two thirds of the list. The reader's eye reads that as a bug
 * before it reads it as data, and it is the single most common state.
 *
 * So the decision is made once, here, and returned as a discriminated union
 * instead of a string: the caller renders a shape it has been told about rather
 * than parsing prose back out of a formatted line. Four shapes cover every row
 * the column pair can produce:
 *
 * - `single`: one date, printed once. The majority case.
 * - `range`: two genuinely different days, plus how far apart they are.
 * - `partial`: one end recorded and the other not, which the schema allows
 *   independently and which must not be silently promoted to a range.
 * - `unrecorded`: neither end. It gets words, not an empty dash, because a
 *   dash in a value slot is indistinguishable from a rendering failure.
 *
 * **Day precision is kept.** A month-and-year rendering ("Mar 2019") throws away
 * the one piece of information the traveller actually typed in, and makes two
 * visits three weeks apart look identical. Formatting goes through the shared
 * `en-GB` / UTC formatters, so the server pass and the hydration pass produce
 * the same characters and no date is ever shifted by a reader's time zone.
 *
 * **Why not `formatDateRange`.** That helper elides a repeated month and year,
 * so 1 June and 13 June 2026 become "1 – 13 Jun 2026". That is right for a trip,
 * which is one continuous stay, and wrong here: these are two separate journeys
 * weeks or years apart, and collapsing them implies the traveller was in the
 * country for the whole interval. Both ends are therefore always printed whole.
 */
import { formatDate, parseIsoDate, pluralise } from '#/routes/_app/-lib/format'

const DAY_MS = 86_400_000

/** Average days per Gregorian month and year, for the "how far apart" line. */
const DAYS_PER_MONTH = 30.436875
const DAYS_PER_YEAR = 365.2425

/** The copy for a country whose dates were never filled in. */
export const UNRECORDED_VISIT_LABEL = 'Dates not recorded'

/** One end of a span: printable, and machine-readable for a `<time>`. */
export interface VisitDate {
  /** Canonical `YYYY-MM-DD`, for a `<time dateTime>` attribute. */
  readonly iso: string
  /** `14 Jul 2011`, in the product's pinned `en-GB` / UTC formatting. */
  readonly label: string
}

/** Visited once, or visited repeatedly but only ever on the one recorded day. */
export interface VisitSpanSingle {
  readonly kind: 'single'
  readonly date: VisitDate
  readonly summary: string
}

/** Two different days, and the distance between them. */
export interface VisitSpanRange {
  readonly kind: 'range'
  readonly first: VisitDate
  readonly last: VisitDate
  /** Whole days between the two visits. Always at least 1. */
  readonly days: number
  /** `13 years apart`, coarsened to the grain a reader can hold. */
  readonly gap: string
  readonly summary: string
}

/** One end recorded, the other left null. Never dressed up as a range. */
export interface VisitSpanPartial {
  readonly kind: 'partial'
  /** Which end we actually have. */
  readonly edge: 'first' | 'last'
  readonly date: VisitDate
  readonly summary: string
}

/** Neither end recorded, or both unusable. */
export interface VisitSpanUnrecorded {
  readonly kind: 'unrecorded'
  readonly summary: string
}

export type VisitSpan =
  VisitSpanSingle | VisitSpanRange | VisitSpanPartial | VisitSpanUnrecorded

/** A parsed end, kept with its `Date` so the gap needs no second parse. */
interface ParsedVisit {
  readonly at: Date
  readonly point: VisitDate
}

/**
 * Parses one day column into a printable end, or `null` when it is unusable.
 *
 * Unusable covers null, empty, a truncated column and a string that looks like
 * a date but is not one (`2011-13-45`). Every one of those becomes "we do not
 * know", never a thrown error and never `Invalid Date` on the screen.
 */
function parseVisit(value: string | null | undefined): ParsedVisit | null {
  const at = parseIsoDate(value)
  if (at === null) {
    return null
  }
  const label = formatDate(value)
  if (label === null) {
    return null
  }
  return { at, point: { iso: at.toISOString().slice(0, 10), label } }
}

/**
 * How far apart two visits are, in the coarsest unit that is still true.
 *
 * Days below two months, because "58 days apart" is a fact a traveller
 * recognises; months below two years; whole years after that, where a decimal
 * would be false precision against a date the reader can already see.
 */
function gapLabel(days: number): string {
  if (days < 60) {
    return `${pluralise(days, 'day')} apart`
  }
  const months = Math.round(days / DAYS_PER_MONTH)
  if (months < 24) {
    return `${pluralise(months, 'month')} apart`
  }
  return `${pluralise(Math.round(days / DAYS_PER_YEAR), 'year')} apart`
}

/**
 * Turns a country's two day columns into the shape a record should render.
 *
 * Order is normalised rather than trusted: a row whose "first" is later than
 * its "last" is corrupt data, and the honest response is to print the earlier
 * day as the first visit, not to print a range that runs backwards.
 */
export function visitSpan(
  firstVisitedOn: string | null | undefined,
  lastVisitedOn: string | null | undefined,
): VisitSpan {
  const opened = parseVisit(firstVisitedOn)
  const closed = parseVisit(lastVisitedOn)

  if (opened === null) {
    if (closed === null) {
      return { kind: 'unrecorded', summary: UNRECORDED_VISIT_LABEL }
    }
    return {
      kind: 'partial',
      edge: 'last',
      date: closed.point,
      summary: `Latest visit ${closed.point.label}`,
    }
  }

  if (closed === null) {
    return {
      kind: 'partial',
      edge: 'first',
      date: opened.point,
      summary: `First visit ${opened.point.label}`,
    }
  }

  const days = Math.round(
    Math.abs(closed.at.getTime() - opened.at.getTime()) / DAY_MS,
  )
  if (days === 0) {
    return {
      kind: 'single',
      date: opened.point,
      summary: `Visited ${opened.point.label}`,
    }
  }

  const forward = opened.at.getTime() < closed.at.getTime()
  const first = forward ? opened.point : closed.point
  const last = forward ? closed.point : opened.point

  return {
    kind: 'range',
    first,
    last,
    days,
    gap: gapLabel(days),
    summary: `${first.label} – ${last.label}`,
  }
}
