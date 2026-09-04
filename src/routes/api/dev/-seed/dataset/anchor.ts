/**
 * The one instant the demo fixture calls "now".
 *
 * ## Why the fixture needs an anchor at all
 *
 * The Worker decides *which rows* a screen shows by comparing a date column
 * against its own notion of today — `listUpcomingTrips` keeps a trip while
 * `endDate >= today`, `listUpcomingReservations` reads forward from `today`, the
 * journal splits its backlog on it. A fixture written in loose calendar literals
 * therefore has a shelf life: the trip that is "in progress" stops being in
 * progress, the reservation rail empties for good, and an end-to-end journey that
 * navigates from a list to the trip in it starts skipping because the trip is no
 * longer there. That is a suite going green by covering less, on a morning nobody
 * touched it — the silent loss ADR 0016 says the thinner e2e layer must not buy.
 *
 * Every date this fixture writes is therefore an offset from one anchor, and the
 * anchor is a constant rather than a clock. Nothing under `-seed/` reads the wall
 * clock or a random source except the stopwatch that reports how long a run took,
 * and that number is never written to a row — which is what makes the seeded
 * workspace a pure function of this directory: seed it twice, on two machines, in
 * two calendar months, and D1 holds the same rows both times.
 *
 * ## Why the anchor is *this* day
 *
 * `SEED_ANCHOR_DAY` is the day the end-to-end suite tells the Worker it is.
 * `serverToday()` in `src/server/clock.ts` accepts an `x-pt-server-today` header
 * on a development request, and `playwright.config.ts` sends `FIXTURE_DAY` on
 * both browser projects — so the fixture and the reader of the fixture agree
 * about the day without either of them asking the machine. The two constants are
 * deliberately duplicated across the `src/` and `e2e/` boundary (nothing in the
 * Worker may import a test helper) and `__tests__/fixture-calendar.test.ts` reads
 * the config back off disk and fails if they ever drift apart.
 *
 * Moving the anchor translates the whole fixture calendar rigidly. Do it in one
 * commit, with `FIXTURE_DAY` in `playwright.config.ts` moved to match.
 *
 * ## The three helpers, and when each is right
 *
 * - `day(offset)` — a date that means something *relative to now*: a trip, a
 *   booking, an expense, a journal entry, the leave someone booked for a trip.
 *   These are the dates the Worker compares against `today`, so these are the
 *   ones that have to travel with the anchor.
 * - `anchorYearDay('12-24')` — a calendar fact that recurs every year: Christmas
 *   Eve, the summer closure. It belongs to the fixture's *year*, not to a
 *   distance from its today, and translating it by days would put a label that
 *   says "Christmas Eve" on the 19th of December.
 * - `historic('2011-07-14')` — biography that happened long before the fixture
 *   window and is not measured from it: the first time somebody set foot in a
 *   country. Anchoring these would express "fifteen years ago" as `day(-5516)`,
 *   which is unreadable and would silently rewrite a traveller's history the day
 *   the anchor moved by a week. The call is deliberately not a bare literal so
 *   that every absolute date in the fixture is greppable and has said why.
 */

/** Days in a day, in milliseconds. UTC throughout: no zone, no DST, no drift. */
const MS_PER_DAY = 86_400_000

/**
 * The fixture's today, as `YYYY-MM-DD`.
 *
 * Keep in step with `FIXTURE_DAY` in `playwright.config.ts`.
 * `__tests__/fixture-calendar.test.ts` enforces it.
 */
export const SEED_ANCHOR_DAY = '2026-08-20'

/**
 * The fixture's now, as an instant.
 *
 * Midday UTC rather than midnight: the demo workspace runs on `Europe/London`,
 * and a midnight anchor would render "yesterday" for every British reader of a
 * timestamp stamped on the anchor itself.
 */
export const SEED_ANCHOR_INSTANT = new Date(`${SEED_ANCHOR_DAY}T12:00:00.000Z`)

/** The anchor as UTC midnight, which is what day arithmetic counts from. */
const ANCHOR_MIDNIGHT = Date.parse(`${SEED_ANCHOR_DAY}T00:00:00.000Z`)

function isoDay(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10)
}

/**
 * A calendar day `offset` days from the anchor. Negative is the past.
 *
 * `day(0)` is the fixture's today, `day(-3)` is three days ago, `day(50)` is
 * seven weeks out. Whole days only — a fractional offset is a mistake at the call
 * site rather than a rounding question here.
 */
export function day(offset: number): string {
  if (!Number.isInteger(offset)) {
    throw new TypeError(
      `seed anchor: day() takes whole days, received ${String(offset)}`,
    )
  }
  return isoDay(ANCHOR_MIDNIGHT + offset * MS_PER_DAY)
}

/**
 * An instant `offset` days from the anchor, at `time` in UTC.
 *
 * For the rows that carry a timestamp rather than a date — a photo's `takenAt`, a
 * chat message, an onboarding stamp.
 */
export function instantOn(offset: number, time = '12:00'): Date {
  return new Date(`${day(offset)}T${time}:00.000Z`)
}

/** An instant `minutes` before the anchor, for a fixture inbox that reads as fresh. */
export function minutesBeforeAnchor(minutes: number): Date {
  return new Date(SEED_ANCHOR_INSTANT.getTime() - minutes * 60_000)
}

/**
 * Whole days from the anchor to a fixture date, floored at zero.
 *
 * The inverse of `day()`, for copy that has to say how far away something is.
 */
export function daysFromAnchor(date: string | null): number {
  if (date === null) {
    return 0
  }
  const target = Date.parse(`${date}T00:00:00.000Z`)
  if (Number.isNaN(target)) {
    return 0
  }
  return Math.max(Math.round((target - ANCHOR_MIDNIGHT) / MS_PER_DAY), 0)
}

/** The anchor's calendar year, as a number. */
export const SEED_ANCHOR_YEAR = Number(SEED_ANCHOR_DAY.slice(0, 4))

/**
 * A recurring calendar fact in the anchor's year, given as `MM-DD`.
 *
 * A public holiday is a month and a day, not a distance from today. Translating
 * one by the anchor's offset would leave its own label lying about it.
 */
export function anchorYearDay(monthDay: string): string {
  const candidate = `${String(SEED_ANCHOR_YEAR)}-${monthDay}`
  if (isoDay(Date.parse(`${candidate}T00:00:00.000Z`)) !== candidate) {
    throw new TypeError(
      `seed anchor: anchorYearDay() needs a real MM-DD, received ${monthDay}`,
    )
  }
  return candidate
}

/** The first day of the fixture window: everything `historic()` must precede. */
const FIXTURE_WINDOW_START = '2025-01-01'

/**
 * A date the anchor deliberately does not move.
 *
 * Reserved for biography that predates the fixture window — the years somebody
 * first visited a country, which the atlas colours by recency and no repository
 * ever compares against `today`. Validated rather than trusted: a date inside the
 * fixture window reached for through here is a date that meant "relative to now"
 * and should have been `day()`.
 */
export function historic(date: string): string {
  if (isoDay(Date.parse(`${date}T00:00:00.000Z`)) !== date) {
    throw new TypeError(
      `seed anchor: historic() needs a real YYYY-MM-DD, received ${date}`,
    )
  }
  if (date >= FIXTURE_WINDOW_START) {
    throw new RangeError(
      `seed anchor: ${date} is inside the fixture window and must be written as day(), not historic()`,
    )
  }
  return date
}
