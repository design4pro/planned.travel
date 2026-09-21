/**
 * When a Transport or a Leg happens: the one owner of "it arrives after it departs" and "how long
 * it takes".
 *
 * Both questions are asked on the client, live as the traveller types, and on the server, where
 * the repository refuses a record the form would have refused. They used to be answered by three
 * copies that disagreed about clocks, so a westbound Leg was labelled seven hours by one of them
 * and refused as arriving before it departed by the next. This module has no imports from either
 * side for that reason: the dialog and the repository ask the same function.
 *
 * **One rule.** When both ends name a zone, each end is a real instant — its wall clock offset by
 * its own zone **on its own date**, so a journey across a daylight-saving switch is measured
 * across it. Otherwise both ends are wall clocks, compared in the frame the traveller typed them
 * in. One zone is not enough: a real instant against a wall clock is wrong by an offset nobody
 * stated, which is worse than the wall-clock reading every row written before zones existed has.
 *
 * Not in `time.ts`: that module formats instants, and `timezones.ts`, which this one builds on,
 * already imports it.
 */

import { resolveTimeZone } from './time'
import { timeZoneOffsetMinutes } from './timezones'

/** An ISO calendar date, `YYYY-MM-DD`, as every date field of a Transport or a Leg holds it. */
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u

/** A 24-hour wall-clock time, `HH:MM`. */
export const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u

/** The four clocks of a Transport or a Leg, as a form holds them (`''`) or a row stores them (`null`). */
export interface LegClocks {
  readonly departureDate?: string | null
  readonly departureTime?: string | null
  readonly arrivalDate?: string | null
  readonly arrivalTime?: string | null
}

/** The zones of its two ends — the stations' zones for a Leg, the record's for a Transport. */
export interface LegZones {
  readonly from?: string | null
  readonly to?: string | null
}

const START_OF_DAY = '00:00'
const END_OF_DAY = '23:59'

/** A zone the platform knows, or `null` for a blank, missing or unknown one. */
function zoneOf(value: string | null | undefined): string | null {
  const zone = value?.trim() ?? ''
  return zone !== '' && resolveTimeZone(zone) === zone ? zone : null
}

/** Both zones, or neither: the rule the module header states. */
function framesOf(zones: LegZones | undefined): {
  readonly from: string | null
  readonly to: string | null
} {
  const from = zoneOf(zones?.from)
  const to = zoneOf(zones?.to)
  return from !== null && to !== null ? { from, to } : { from: null, to: null }
}

function clockInstant(
  date: string | null | undefined,
  time: string | null | undefined,
  missingTime: string,
  zone: string | null,
): number | null {
  if (typeof date !== 'string' || !DATE_PATTERN.test(date)) {
    return null
  }
  const clock =
    typeof time === 'string' && /^\d{2}:\d{2}/u.test(time)
      ? time.slice(0, 5)
      : missingTime
  const parsed = Date.parse(`${date}T${clock}:00.000Z`)
  if (Number.isNaN(parsed)) {
    return null
  }
  return zone === null
    ? parsed
    : parsed - timeZoneOffsetMinutes(zone, date) * 60_000
}

/**
 * The instant of a date and a time in milliseconds, or `null` when the date is not one.
 *
 * With no zone it is the wall clock read as if it were UTC — comparable only with other wall
 * clocks, which is what sorting a trip's journeys needs. A missing time is the start of the day.
 */
export function instantAt(
  date: string | null | undefined,
  time: string | null | undefined,
  zone?: string | null,
): number | null {
  return clockInstant(date, time, START_OF_DAY, zoneOf(zone))
}

/**
 * Whether a Transport or a Leg lands before it takes off.
 *
 * A missing time reads as the start of the day at departure and the end of it at arrival, so an
 * end the traveller has not timed yet is never *wrongly* flagged; a missing date is no order to
 * break at all.
 */
export function arrivesBeforeDeparts(
  clocks: LegClocks,
  zones?: LegZones,
): boolean {
  const frames = framesOf(zones)
  const departed = clockInstant(
    clocks.departureDate,
    clocks.departureTime,
    START_OF_DAY,
    frames.from,
  )
  const arrived = clockInstant(
    clocks.arrivalDate,
    clocks.arrivalTime,
    END_OF_DAY,
    frames.to,
  )
  return departed !== null && arrived !== null && arrived < departed
}

/**
 * Minutes from departure to arrival, or `null` when either date is unknown or the journey takes
 * no time or less — which the forms report as an error rather than as a duration.
 *
 * A missing time here is the start of its day at both ends: a duration is a number shown to the
 * traveller, and a guessed end of day would read as one they typed.
 */
export function elapsedMinutes(
  clocks: LegClocks,
  zones?: LegZones,
): number | null {
  const frames = framesOf(zones)
  const departed = clockInstant(
    clocks.departureDate,
    clocks.departureTime,
    START_OF_DAY,
    frames.from,
  )
  const arrived = clockInstant(
    clocks.arrivalDate,
    clocks.arrivalTime,
    START_OF_DAY,
    frames.to,
  )
  if (departed === null || arrived === null || arrived <= departed) {
    return null
  }
  return Math.round((arrived - departed) / 60_000)
}
