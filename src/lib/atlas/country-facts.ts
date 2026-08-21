/**
 * What the atlas knows about one country, resolved into the exact strings a
 * card prints.
 *
 * The world map has two surfaces that say the same thing: a card that follows
 * the pointer and a card that stays put when you click. If each of them decided
 * for itself how to plural a unit, when a month is missing and what a reader
 * hears instead of a dash, the two would disagree the first time either was
 * edited — and a product whose hover and its click report different facts about
 * the same country has a credibility problem, not a formatting one. So the
 * decisions are made once, here, and returned as data. The card renders a shape
 * it has been handed rather than parsing prose back out of a formatted line.
 *
 * **Nothing in this module asks the platform to format anything.** Names come
 * from the frozen table in `./country-names`, and months from `formatMonthYear`
 * in `#/lib/format`, which is the product's single date formatter. Both exist
 * because the two runtimes this app renders in disagree with each other:
 * `Intl.DisplayNames` gives a different spelling for a handful of regions in
 * workerd than it does in WebKit, and `Intl.DateTimeFormat` shortens September
 * to `Sept` in one and `Sep` in the other. Either difference is a text node
 * that changes between the server pass and the hydration pass, which is a React
 * hydration error, which is a console error — and that exact error has already
 * been shipped on the atlas once. There is no `Intl` constructor in this file
 * and there must never be one.
 *
 * **Counts are clamped rather than trusted.** These figures arrive from an
 * aggregate query, and an aggregate that has gone wrong should print `0`, not
 * `-1`, `NaN` or `3.0000000004`.
 */
import { countryName } from '#/lib/atlas/country-names'
import {
  formatMonthYear,
  formatNumber,
  parseInstant,
  parseIsoDate,
  pluralise,
} from '#/lib/format'

/**
 * What a card prints where a month should be and there is none.
 *
 * An em dash, and only ever behind `aria-hidden`: a screen reader announcing
 * "dash" for a missing first trip is indistinguishable from one announcing a
 * hyphen in a value, and both are indistinguishable from a rendering failure.
 * The card pairs this with {@link ABSENT_FACT_LABEL} so the eye gets the mark
 * and the ear gets the words.
 */
export const ABSENT_FACT_MARK = '—'

/** What a reader hears in place of {@link ABSENT_FACT_MARK}. */
export const ABSENT_FACT_LABEL = 'Not recorded'

/** One counted figure: a unit heading, the number, and the number as printed. */
export interface CountryFactFigure {
  /** `Trip` or `Trips` — the unit, agreeing with the count. */
  readonly label: string
  /** The clamped count, for a caller that needs to branch on it. */
  readonly count: number
  /** The count as printed, grouped: `1,204`. */
  readonly value: string
}

/** One month-precision date, printable and machine-readable. */
export interface CountryFactMonth {
  readonly label: string
  /** `September 2026`, or `null` when the column was never filled in. */
  readonly value: string | null
  /** `2026-09`, for a `<time dateTime>`. `null` alongside a `null` value. */
  readonly iso: string | null
}

/** The columns a caller has about a country. Every one may be absent or zero. */
export interface CountryFactsInput {
  /** ISO 3166-1 alpha-2, in whatever case the row happened to store. */
  readonly countryCode: string
  /** Trips whose itinerary touches this country. */
  readonly tripCount: number
  /** Saved places inside it. */
  readonly placeCount: number
  /** First day recorded in the country, as `YYYY-MM-DD` or an ISO instant. */
  readonly firstTripOn: string | null | undefined
  /** Last day recorded in the country. */
  readonly lastTripOn: string | null | undefined
}

/** Everything a country card renders, and nothing it has to work out itself. */
export interface CountryFacts {
  /** Normalised alpha-2. */
  readonly code: string
  /** The name we print, from the frozen table. */
  readonly name: string
  /** True once anything at all has been recorded here. */
  readonly visited: boolean
  readonly trips: CountryFactFigure
  readonly places: CountryFactFigure
  readonly first: CountryFactMonth
  readonly last: CountryFactMonth
  /**
   * The whole card as one sentence, for a trigger that has to carry its own
   * accessible name — a map polygon has no text of its own, and a card that
   * only exists while the pointer is over it cannot be that name.
   */
  readonly summary: string
}

/**
 * A count as the card is willing to print it: a whole number, never negative.
 *
 * `Math.trunc` rather than `Math.round`, because a fractional count is a bug
 * upstream and rounding 0.6 up to `1 trip` invents a journey.
 */
export function countryFactCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.trunc(value))
}

/**
 * One day column, coarsened to the month it fell in.
 *
 * Month precision is the right grain for this card and only this card: it sits
 * on a map, it is read in a glance, and "September 2026" is what a traveller
 * remembers. The full-precision reading lives in the atlas panel's country
 * record, which prints both ends as whole days.
 */
export function countryFactMonth(
  label: string,
  value: string | null | undefined,
): CountryFactMonth {
  const at = parseIsoDate(value) ?? parseInstant(value)
  const printed = at === null ? null : formatMonthYear(value)
  if (at === null || printed === null) {
    return { label, value: null, iso: null }
  }
  const month = String(at.getUTCMonth() + 1).padStart(2, '0')
  return { label, value: printed, iso: `${at.getUTCFullYear()}-${month}` }
}

/**
 * The unit heading over a numeral, agreeing with it.
 *
 * The heading sits above the number rather than beside it, so `1` under `TRIPS`
 * would still parse — but a card that says `TRIPS` over `1` and `PLACES` over
 * `1` in the same row, when the reference product it is judged against manages
 * the agreement, is a detail lost for nothing. The column is a fixed width, so
 * the shorter word costs no movement.
 */
function figure(
  count: number,
  singular: string,
  plural: string,
): CountryFactFigure {
  const clamped = countryFactCount(count)
  return {
    label: clamped === 1 ? singular : plural,
    count: clamped,
    value: formatNumber(clamped),
  }
}

/**
 * `no trips yet` reads better than `0 trips` in a spoken sentence.
 *
 * The singular is passed in rather than read off `label`, which already agrees
 * with the count: `pluralise` does its own agreement, and handing it a plural
 * produces `3 tripss`.
 */
function figurePhrase(
  value: CountryFactFigure,
  singular: string,
  empty: string,
): string {
  return value.count === 0 ? empty : pluralise(value.count, singular)
}

/**
 * The two months as one clause.
 *
 * A country visited inside a single month gets one statement rather than the
 * same month read out twice under two different headings — the card still shows
 * both cells, because they are two columns of a table and a table with a hole
 * in it reads as a fault, but a sentence has no such obligation.
 */
function monthPhrase(first: CountryFactMonth, last: CountryFactMonth): string {
  if (first.value === null && last.value === null) {
    return 'No trip dates recorded'
  }
  if (first.value !== null && last.value !== null) {
    return first.iso === last.iso
      ? `Travelled in ${first.value}`
      : `First trip ${first.value}, last trip ${last.value}`
  }
  if (first.value !== null) {
    return `First trip ${first.value}, last trip not recorded`
  }
  return `First trip not recorded, last trip ${last.value ?? ''}`
}

/** Opens a clause as a sentence. A clause starting with a digit is left alone. */
function sentence(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1)
}

/**
 * Every string one country card prints, from the columns behind it.
 *
 * Pure, synchronous and free of any component import, so the card can be built
 * and proved before there is a map to hang it on.
 */
export function countryFacts(input: CountryFactsInput): CountryFacts {
  const code = input.countryCode.trim().toUpperCase()
  const trips = figure(input.tripCount, 'Trip', 'Trips')
  const places = figure(input.placeCount, 'Place', 'Places')
  const first = countryFactMonth('First trip', input.firstTripOn)
  const last = countryFactMonth('Last trip', input.lastTripOn)
  const name = countryName(code)

  const counted = `${figurePhrase(trips, 'trip', 'no trips yet')}, ${figurePhrase(
    places,
    'place',
    'no places saved',
  )}`

  return {
    code,
    name,
    visited:
      trips.count > 0 ||
      places.count > 0 ||
      first.iso !== null ||
      last.iso !== null,
    trips,
    places,
    first,
    last,
    summary: `${name}. ${sentence(counted)}. ${monthPhrase(first, last)}.`,
  }
}
