/**
 * A stored wall-clock time and an IANA zone, turned into the instant it names.
 *
 * Used for legs and transports only, the two records that carry their own zone. A stop or a
 * reservation sits at a place, a place has no zone, and the calendar writes it floating instead.
 *
 * The offset comes from `Intl.DateTimeFormat` with `timeZoneName: 'longOffset'`, which prints a
 * number (`GMT+09:00`) and never a name, so workerd and WebKit cannot disagree about what a zone is
 * called (docs/SPEC.md §9). This module runs only in the Worker.
 */

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME = /^(\d{2}):(\d{2})/
/** `GMT`, `GMT+9`, `GMT+09:00`, with an ASCII hyphen or the U+2212 minus ICU can print. */
const LONG_OFFSET = /^GMT(?:([+\-−])(\d{1,2})(?::(\d{2}))?)?$/

/** One formatter per zone: a feed of many legs would otherwise build one per call. `null`: invalid. */
const formatters = new Map<string, Intl.DateTimeFormat | null>()

function formatterFor(zone: string): Intl.DateTimeFormat | null {
  const known = formatters.get(zone)
  if (known !== undefined) {
    return known
  }
  let formatter: Intl.DateTimeFormat | null
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'longOffset',
    })
  } catch {
    formatter = null
  }
  formatters.set(zone, formatter)
  return formatter
}

/** The zone's offset from UTC, in milliseconds, at an instant. `null` when the zone is unusable. */
function offsetAt(
  formatter: Intl.DateTimeFormat,
  instant: number,
): number | null {
  const part = formatter
    .formatToParts(new Date(instant))
    .find((candidate) => candidate.type === 'timeZoneName')
  const match = part === undefined ? null : LONG_OFFSET.exec(part.value)
  if (match === null) {
    return null
  }
  const [, sign, hours, minutes] = match
  if (sign === undefined || hours === undefined) {
    return 0
  }
  const magnitude = (Number(hours) * 60 + Number(minutes ?? '0')) * MINUTE_MS
  return sign === '+' ? magnitude : -magnitude
}

/**
 * The UTC instant of `date` (`YYYY-MM-DD`) at `time` (`HH:MM`) on the wall clocks of `zone`, or
 * `null` when the zone, the date or the time is not usable (the caller then writes the event
 * floating).
 *
 * A time that does not exist (the spring-forward gap) takes the offset in force just before the
 * gap; a time that happens twice (the autumn overlap) takes the first occurrence.
 */
export function zonedToUtc(
  date: string,
  time: string,
  zone: string,
): Date | null {
  const dateMatch = DATE.exec(date)
  const timeMatch = TIME.exec(time)
  if (dateMatch === null || timeMatch === null) {
    return null
  }
  const formatter = formatterFor(zone)
  if (formatter === null) {
    return null
  }

  // The wall-clock reading as if it were UTC; the real instant is this minus the offset.
  const wallClock = Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  )
  if (Number.isNaN(wallClock)) {
    return null
  }

  // A day either side of the reading is clear of any single transition near it, so these are the
  // offset before the change and the offset after it (the same one when there is no change).
  const before = offsetAt(formatter, wallClock - DAY_MS)
  const after = offsetAt(formatter, wallClock + DAY_MS)
  if (before === null || after === null) {
    return null
  }

  const instants = [before, after]
    .map((offset) => ({ offset, instant: wallClock - offset }))
    .filter(({ offset, instant }) => offsetAt(formatter, instant) === offset)
    .map(({ instant }) => instant)

  // Several candidates is the overlap: the earliest is the first time the clock showed it. None is
  // the gap: the offset before the change applies.
  const chosen =
    instants.length > 0 ? Math.min(...instants) : wallClock - before
  return new Date(chosen)
}
