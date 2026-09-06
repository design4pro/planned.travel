/**
 * The zone list a picker offers, and the local-clock label that sits under a
 * time input.
 *
 * ## Why this is not `src/lib/time.ts`
 *
 * That module owns *formatting an instant in a zone* and *narrowing a stored
 * zone to one `Intl` accepts* ({@link resolveTimeZone}). It does not enumerate,
 * and enumeration is a different job with a different failure mode: a list is
 * something a person picks from, so it has to be complete, ordered, grouped and
 * — the part nothing else checks — a subset of what the validator accepts. This
 * module enumerates and labels; it calls `resolveTimeZone` for validation rather
 * than re-implementing it, and it holds no table of its own, so it cannot go
 * stale the way a checked-in list would.
 *
 * ## Why a time needs a zone at all
 *
 * A departure time is a **wall clock at the place it departs from**. `14:05` out
 * of Tokyo is stored as `14:05` and is not converted on the way in, because the
 * number on the ticket is the number the traveller reads at the gate. That makes
 * the zone the only thing standing between a correct record and a departure
 * silently re-read in whichever zone the reader happens to be sitting in — so
 * every time input carries the label this module produces, beside the field
 * rather than in a settings panel somewhere.
 *
 * ## The offset is computed, never read off a formatted name
 *
 * `timeZoneName: 'shortOffset'` would answer `GMT+9` directly, and it is exactly
 * the kind of call `docs/plans/12-verification-protocol.md` §7.2 defers: an
 * engine resolves those names from its own ICU build, and workerd and WebKit do
 * not always agree. So the offset is derived arithmetically from `en-CA`
 * *numeric* parts — the same trick `src/lib/time.ts` already uses for a day key —
 * and this module writes the `UTC±h[:mm]` text itself. Numbers are numbers in
 * every ICU build; names are not.
 *
 * The offset is a function of the **instant**, not of when the label is
 * rendered: Paris is `UTC+1` in January and `UTC+2` in July. Every entry point
 * therefore takes the date the time is on, and a fixed date gives a fixed answer
 * on a server and in a browser alike.
 */

import { FALLBACK_TIME_ZONE, resolveTimeZone } from './time'

/** Zones with no region in their name — `UTC` and its handful of siblings. */
const UNREGIONED = 'Other'

/**
 * Every zone the platform knows, sorted.
 *
 * `Intl.supportedValuesOf` is the platform's own answer and is available in
 * every engine this product supports — measured at 418 zones on the build
 * machine, and present in workerd and in every browser the product targets.
 *
 * The `catch` is not for those. It is for a Node built without full ICU, which
 * the type system cannot express and which no amount of reading `lib.es*.d.ts`
 * will warn about: there the call throws, and a throw at *module scope* takes
 * down every route that imports this file rather than degrading one picker.
 * `UTC` alone is what the rest of the stack already falls back to.
 */
function enumerate(): Array<string> {
  try {
    return [...Intl.supportedValuesOf('timeZone')].sort()
  } catch {
    return [FALLBACK_TIME_ZONE]
  }
}

export const TIME_ZONES: ReadonlyArray<string> = Object.freeze(enumerate())

const KNOWN = new Set(TIME_ZONES)

/** True for a name this module's own list carries. */
export function isKnownTimeZone(zone: string | null | undefined): boolean {
  return typeof zone === 'string' && KNOWN.has(zone)
}

/**
 * The heading a zone is filed under in the picker: `Asia/Tokyo` → `Asia`.
 *
 * Only the first segment, so `America/Argentina/Ushuaia` files under `America`
 * with the rest of the continent rather than under a group of its own.
 */
export function timeZoneRegion(zone: string): string {
  const slash = zone.indexOf('/')
  return slash === -1 ? UNREGIONED : zone.slice(0, slash)
}

/** The city part, with the underscores a person does not read spelled out. */
function timeZoneCity(zone: string): string {
  const slash = zone.indexOf('/')
  return (slash === -1 ? zone : zone.slice(slash + 1)).replaceAll('_', ' ')
}

/* -------------------------------------------------------------------------------------------------
 * Offsets
 * ---------------------------------------------------------------------------------------------- */

const offsetFormatters = new Map<string, Intl.DateTimeFormat>()

function offsetFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = offsetFormatters.get(timeZone)
  if (cached !== undefined) return cached
  const made = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  offsetFormatters.set(timeZone, made)
  return made
}

/**
 * The instant a label is computed against.
 *
 * Noon rather than midnight: a zone whose DST transition happens at 00:00 local
 * would otherwise be read on the wrong side of its own switch, and no zone
 * changes offset at midday.
 */
const NOON = 'T12:00:00.000Z'

function instantFor(date: string | null | undefined): Date {
  const parsed =
    typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(date)
      ? new Date(`${date}${NOON}`)
      : new Date(Number.NaN)
  return Number.isNaN(parsed.getTime()) ? new Date(`2026-01-01${NOON}`) : parsed
}

/** Minutes this zone is ahead of UTC at `at`, from numeric parts alone. */
function offsetMinutes(timeZone: string, at: Date): number {
  const parts = offsetFormatter(timeZone).formatToParts(at)
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0')

  const asUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
  )
  // The reference instant is whole-minute, so the difference is too.
  return Math.round((asUtc - at.getTime()) / 60_000)
}

/**
 * `UTC+9`, `UTC+5:30`, `UTC-8`, `UTC` — the offset of a zone on a given date.
 *
 * The minutes are printed only when there are any, because `UTC+9:00` reads as a
 * precision nobody asked for next to the twenty-odd zones that genuinely need
 * it. A zone the platform rejects is resolved to {@link FALLBACK_TIME_ZONE}
 * first, so this answers rather than throwing.
 */
export function timeZoneOffsetLabel(
  zone: string | null | undefined,
  date?: string | null,
): string {
  const total = offsetMinutes(resolveTimeZone(zone), instantFor(date))
  if (total === 0) return 'UTC'

  const sign = total < 0 ? '-' : '+'
  const magnitude = Math.abs(total)
  const hours = Math.trunc(magnitude / 60)
  const minutes = magnitude % 60
  return minutes === 0
    ? `UTC${sign}${hours}`
    : `UTC${sign}${hours}:${String(minutes).padStart(2, '0')}`
}

/**
 * Minutes a zone is ahead of UTC on a given date — `540` for `Asia/Tokyo`, `-300` for
 * `America/New_York` in winter.
 *
 * The same number {@link timeZoneOffsetLabel} prints, exported for the callers that have to do
 * arithmetic with it rather than show it. Two wall clocks in two zones are two different instants,
 * and nothing can subtract one from the other without this.
 *
 * Read on the date asked about, because the answer moves: a zone that is `-300` in January is
 * `-240` in July, and a flight in July priced on January's offset is an hour wrong.
 */
export function timeZoneOffsetMinutes(
  zone: string | null | undefined,
  date?: string | null,
): number {
  return offsetMinutes(resolveTimeZone(zone), instantFor(date))
}

/* -------------------------------------------------------------------------------------------------
 * The picker and the label
 * ---------------------------------------------------------------------------------------------- */

export interface TimeZoneOption {
  readonly value: string
  /** The city, which is what a person is actually looking for. */
  readonly label: string
  /** The offset on the date asked about — the second line of the row. */
  readonly description: string
  /** The uppercase heading the row sits under. */
  readonly group: string
}

/**
 * Every zone as a row for `Combobox`, grouped by region and described by its
 * offset **on the date the time being edited is on**. Two travellers editing the
 * same July departure see the same list whatever month they are reading in.
 */
export function timeZoneOptions(
  date?: string | null,
): ReadonlyArray<TimeZoneOption> {
  return TIME_ZONES.map((zone) => ({
    value: zone,
    label: timeZoneCity(zone),
    description: timeZoneOffsetLabel(zone, date),
    group: timeZoneRegion(zone),
  }))
}

/**
 * `14:05 · Asia/Tokyo (UTC+9)` — what goes under a time input.
 *
 * `null` when the endpoint names no zone, and deliberately not the fallback: a
 * reader would take `(UTC)` for a statement about the departure rather than for
 * the absence of one. An endpoint with no zone is a field the traveller still
 * has to fill, and the form says so in its own words.
 */
export function localClockLabel(endpoint: {
  readonly time: string
  readonly timezone: string | null | undefined
  readonly date: string | null | undefined
}): string | null {
  const zone = endpoint.timezone
  if (typeof zone !== 'string' || zone.trim() === '') {
    return null
  }
  const named = zone.trim()
  const offset = timeZoneOffsetLabel(named, endpoint.date)
  const clock = endpoint.time.trim()
  return clock === ''
    ? `${named} (${offset})`
    : `${clock} · ${named} (${offset})`
}
