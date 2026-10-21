/**
 * What the atlas knows about one country, resolved into the facts a card
 * prints.
 *
 * The world map has two surfaces that say the same thing: a card that follows
 * the pointer and a card that stays put when you click. If each of them decided
 * for itself which record a country speaks for, how a count is clamped and when
 * a month is missing, the two would disagree the first time either was
 * edited — and a product whose hover and its click report different facts about
 * the same country has a credibility problem, not a formatting one. So the
 * decisions are made once, here, and returned as data. The card renders a shape
 * it has been handed rather than parsing prose back out of a formatted line.
 *
 * **This module holds no wording.** Every caption, unit and spoken phrase is a
 * key in the locale catalogue (`atlas.card.*`), which is the single copy source;
 * a noun is renamed there and nowhere else.
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
} from '#/lib/format'

/**
 * What a card prints where a month should be and there is none.
 *
 * An em dash, and only ever behind `aria-hidden`: a screen reader announcing
 * "dash" for a missing first trip is indistinguishable from one announcing a
 * hyphen in a value, and both are indistinguishable from a rendering failure.
 * The card pairs this with the `atlas.card.absent` caption so the eye gets the
 * mark and the ear gets the words.
 */
export const ABSENT_FACT_MARK = '—'

/** One counted figure: the number, and the number as printed. */
export interface CountryFactFigure {
  /** The clamped count, for a caller that needs to branch on it. */
  readonly count: number
  /** The count as printed, grouped: `1,204`. */
  readonly value: string
}

/** One month-precision date, printable and machine-readable. */
export interface CountryFactMonth {
  /** `September 2026`, or `null` when the column was never filled in. */
  readonly value: string | null
  /** `2026-09`, for a `<time dateTime>`. `null` alongside a `null` value. */
  readonly iso: string | null
}

/**
 * Which record the card's four cells were drawn from.
 *
 * `trips` is a country with an itinerary behind it; `visits` is a country the
 * traveller marked by hand, with no trip attached — the atlas's whole manual
 * half, and most of any real record; `none` is a country nothing has ever been
 * written about.
 */
export type CountryFactSource = 'trips' | 'visits' | 'none'

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
  /**
   * Visits on the traveller's own record — the tally `markCountryVisited`
   * keeps, which is a count of times they were there and not a count of
   * journeys planned in this product.
   *
   * Optional because a caller that has only the trip aggregates is still a
   * legitimate caller; absent reads exactly as zero.
   */
  readonly visitCount?: number
  /** First day on the visit record, `YYYY-MM-DD` or an ISO instant. */
  readonly firstVisitedOn?: string | null | undefined
  /** Last day on the visit record. */
  readonly lastVisitedOn?: string | null | undefined
}

/**
 * One country's row on the atlas record, in the shape the repository files it.
 *
 * Structural rather than imported: this module is isomorphic and a component
 * may not reach into `server/`, so the columns are restated here and
 * `AtlasCountryRecord` satisfies them by having the same names. If the two ever
 * drift, the type check fails at the call site rather than the card quietly
 * printing a zero.
 */
export interface CountryFactsRecord {
  readonly countryCode: string
  readonly tripCount: number
  /** The repository's name for the places ticked off inside the country. */
  readonly visitedPlaceCount: number
  readonly firstTripOn: string | null
  readonly lastTripOn: string | null
  readonly visitCount: number
  readonly firstVisitedOn: string | null
  readonly lastVisitedOn: string | null
}

/**
 * The columns a card takes, with nothing left undefined.
 *
 * {@link CountryFactsInput} tolerates an absent visit half so a caller holding
 * only the trip aggregates is still a legitimate caller. This is the resolved
 * form: every field present, so it can be spread straight onto a card whose
 * props are `string | null` rather than optional.
 */
export interface CountryFactColumns {
  readonly countryCode: string
  readonly tripCount: number
  readonly placeCount: number
  readonly firstTripOn: string | null
  readonly lastTripOn: string | null
  readonly visitCount: number
  readonly firstVisitedOn: string | null
  readonly lastVisitedOn: string | null
}

/**
 * An atlas record read as the columns of a card — the one place that reading is
 * written down.
 *
 * The map's card and the shelf's country row are fed from the same repository
 * row, and the defect this exists to prevent is the two of them projecting it
 * differently: the shelf printed `2 visits · 11 Apr 2015` while the card, given
 * only the trip half of the same row, printed `0` and two dashes about the
 * country beside it. So the projection is a function rather than an object
 * literal at each call site, and every surface that renders a country card
 * spreads its result:
 *
 * ```tsx
 * <CountryCard {...countryFactColumns(record)} headingLevel={3} />
 * ```
 *
 * `visitedPlaceCount` is renamed to `placeCount` on the way through, and only
 * that: the repository's name says which places were counted, and the card's
 * says what the column is headed. No figure is combined with another, because
 * a trip and a visit are two different claims about a country and folding them
 * would make the count unverifiable against either surface.
 */
export function countryFactColumns(
  record: CountryFactsRecord,
): CountryFactColumns {
  return {
    countryCode: record.countryCode,
    tripCount: record.tripCount,
    placeCount: record.visitedPlaceCount,
    firstTripOn: record.firstTripOn,
    lastTripOn: record.lastTripOn,
    visitCount: record.visitCount,
    firstVisitedOn: record.firstVisitedOn,
    lastVisitedOn: record.lastVisitedOn,
  }
}

/** Everything a country card renders, and nothing it has to work out itself. */
export interface CountryFacts {
  /** Normalised alpha-2. */
  readonly code: string
  /** The name we print, from the frozen table. */
  readonly name: string
  /** True once anything at all has been recorded here. */
  readonly visited: boolean
  /**
   * Which of the two records {@link tally}, {@link first} and {@link last}
   * speak for, so a card can style the empty state differently from the two
   * that carry something without re-deriving the question.
   */
  readonly source: CountryFactSource
  /**
   * The leading figure: trips when a trip is on record, otherwise the visits
   * that were recorded without one. {@link source} says which, so the card
   * picks the caption for it.
   */
  readonly tally: CountryFactFigure
  readonly places: CountryFactFigure
  readonly first: CountryFactMonth
  readonly last: CountryFactMonth
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
  value: string | null | undefined,
): CountryFactMonth {
  const at = parseIsoDate(value) ?? parseInstant(value)
  const printed = at === null ? null : formatMonthYear(value)
  if (at === null || printed === null) {
    return { value: null, iso: null }
  }
  const month = String(at.getUTCMonth() + 1).padStart(2, '0')
  return { value: printed, iso: `${at.getUTCFullYear()}-${month}` }
}

/** A count clamped to what the card prints, with the number as printed. */
function figure(count: number): CountryFactFigure {
  const clamped = countryFactCount(count)
  return { count: clamped, value: formatNumber(clamped) }
}

/**
 * Every fact one country card prints, from the columns behind it.
 *
 * Pure, synchronous and free of any component import, so the card can be built
 * and proved before there is a map to hang it on.
 *
 * ## Why a country with no trip is not an empty country
 *
 * The map fills a country because it is on the traveller's record, and the
 * record is a list of visits — `markCountryVisited` writes one, and a trip
 * planned in this product is a different thing that may or may not exist beside
 * it. Reading only the trip aggregates therefore prints two zeros and two
 * dashes over a country the same screen has just painted as visited, and says
 * it about most of a real record rather than about an edge case. So the trip
 * columns are consulted first, because an itinerary is the more specific thing
 * to know; when there is no trip at all the visit record answers instead, at
 * the same geometry; and the dashes are kept for the one case that has earned
 * them — a country nothing has ever been written about.
 */
export function countryFacts(input: CountryFactsInput): CountryFacts {
  const code = input.countryCode.trim().toUpperCase()
  const name = countryName(code)
  const places = figure(input.placeCount)

  const tripCount = countryFactCount(input.tripCount)
  const firstTrip = countryFactMonth(input.firstTripOn)
  const lastTrip = countryFactMonth(input.lastTripOn)

  const visitCount = countryFactCount(input.visitCount ?? 0)
  const firstVisit = countryFactMonth(input.firstVisitedOn)
  const lastVisit = countryFactMonth(input.lastVisitedOn)

  // A saved place is deliberately not evidence of a trip here. It is counted in
  // its own cell either way, and letting it choose the record would put a
  // country with a shortlist and a visit back on the trip reading — which is
  // the four-dash card again, wearing a number.
  const hasTrips =
    tripCount > 0 || firstTrip.iso !== null || lastTrip.iso !== null
  const hasVisits =
    visitCount > 0 || firstVisit.iso !== null || lastVisit.iso !== null

  const source: CountryFactSource = hasTrips
    ? 'trips'
    : hasVisits
      ? 'visits'
      : 'none'
  const tally = figure(source === 'visits' ? visitCount : tripCount)
  const first = source === 'visits' ? firstVisit : firstTrip
  const last = source === 'visits' ? lastVisit : lastTrip

  return {
    code,
    name,
    visited: source !== 'none' || places.count > 0,
    source,
    tally,
    places,
    first,
    last,
  }
}
