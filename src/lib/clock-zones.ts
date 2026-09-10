/**
 * The dashboard reference column's one preference, and every decision the clock
 * widget can take without a DOM.
 *
 * ## Why the pure half is a module and not the component's own body
 *
 * Two callers already read this record. The column draws it, and `09-S8` renders
 * the same visibility list as a settings surface a wave later — its own text says
 * it "mints no second one". A declaration living inside the component that draws
 * the column would have to be lifted out the day the second reader arrives, so it
 * starts where it ends up. Everything else here — validation, the label, the
 * offset line, the ordering, the tick delay — is testable without rendering
 * anything, which is the other half of the reason.
 *
 * ## What this module does not re-implement
 *
 * `src/lib/timezones.ts` already enumerates the platform's zones, validates a
 * name against that list, derives a city label from the identifier rather than
 * from a checked-in table, and computes an offset arithmetically from numeric
 * parts. This module composes those; it holds no zone table and no offset table
 * of its own, so it cannot go stale independently of them.
 *
 * ## Validation happens twice, and the two are deliberately not the same check
 *
 * **On the way in**, {@link withZone} refuses anything the picker's own list does
 * not carry, so nothing unofferable is ever written. **On the way out**,
 * {@link readZones} asks the looser question — *will the runtime format this?* —
 * and answers with a refusal row only when it will not.
 *
 * The two differ on purpose, and the gap is not hypothetical. `supportedValuesOf`
 * answers with whichever alias the engine's ICU build files a zone under, and the
 * builds disagree: the one this repository tests on lists `Asia/Calcutta` and
 * `America/Buenos_Aires`, while `Intl.DateTimeFormat` in the same build formats
 * `Asia/Kolkata` and `America/Argentina/Buenos_Aires` perfectly well. A record
 * written on one engine and read on another therefore holds names that are
 * absent from the list and valid all the same, and alarming the reader about a
 * zone that draws correctly would be a bug wearing an error message.
 *
 * A name the reader can no longer be shown is *kept* by the guard below rather
 * than silently dropped: they have to be able to see which zone went away and
 * remove it, and a row that vanished on load is a row that disappeared with no
 * explanation.
 */

import { definePreference } from './local-preference'
import { resolveTimeZone } from './time'
import {
  isKnownTimeZone,
  timeZoneCity,
  timeZoneOffsetMinutes,
} from './timezones'

/**
 * Whether the runtime will format an instant in this zone.
 *
 * `resolveTimeZone` probes inside its own `try` and answers with the fallback on
 * a name `Intl` rejects, so comparing against the input is a total check that
 * never throws — and never hands a bad name to a formatter to find out.
 */
function isFormattableZone(zone: string): boolean {
  return resolveTimeZone(zone) === zone
}

/* -------------------------------------------------------------------------------------------------
 * The preference
 * ---------------------------------------------------------------------------------------------- */

/**
 * The widgets the reference column can hold, in the order they stack in it.
 *
 * The currency converter is deliberately absent rather than present and
 * disabled: it waits on a rate-provider decision (`11-S3`), and a control
 * promising a feature that has no provider is worse than no control.
 */
export const DASHBOARD_WIDGET_IDS = [
  'clock',
  'bookings',
  'tripMix',
  'storage',
] as const

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number]

export interface DashboardWidgetPreference {
  /** Which widgets the column shows. Empty collapses the column entirely. */
  readonly shown: ReadonlyArray<DashboardWidgetId>
  /**
   * The pinned zones, or `null` for "the reader has never chosen".
   *
   * The two are different states and the widget draws them differently: `null`
   * takes the reader's own zone as its default, an empty array is a reader who
   * removed the last row and gets the designed nothing instead.
   */
  readonly zones: ReadonlyArray<string> | null
}

function isWidgetId(value: unknown): value is DashboardWidgetId {
  return (
    typeof value === 'string' &&
    (DASHBOARD_WIDGET_IDS as ReadonlyArray<string>).includes(value)
  )
}

/**
 * The stored record.
 *
 * Unknown widget ids are dropped — a widget that no longer exists cannot be
 * drawn — while unknown *zones* are kept, for the reason in this module's
 * header. The shapes themselves are refused: a payload this guard cannot read is
 * `undefined`, which the preference module treats as absent.
 */
function parseWidgetRecord(raw: string): DashboardWidgetPreference | undefined {
  const value: unknown = JSON.parse(raw)
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }
  const record = value as { shown?: unknown; zones?: unknown }
  if (!Array.isArray(record.shown)) return undefined
  if (record.zones !== null && !Array.isArray(record.zones)) return undefined

  return {
    shown: (record.shown as ReadonlyArray<unknown>).filter(isWidgetId),
    zones:
      record.zones === null
        ? null
        : (record.zones as ReadonlyArray<unknown>).filter(
            (zone): zone is string => typeof zone === 'string',
          ),
  }
}

/**
 * Which widgets the reader keeps, and which zones the clock pins.
 *
 * `local`, not `session`: a widget the reader folded away yesterday that is back
 * this morning is not a preference at all, it is a chore. The trade-off is
 * stated rather than hidden — the fold does not follow the reader to a second
 * device, which is the same call `01-S3` made for the remembered tab.
 */
export const dashboardWidgetPreference =
  definePreference<DashboardWidgetPreference>({
    key: 'planned.dashboard-widgets',
    area: 'local',
    fallback: { shown: DASHBOARD_WIDGET_IDS, zones: null },
    parse: parseWidgetRecord,
  })

/* -------------------------------------------------------------------------------------------------
 * Pinning and unpinning
 * ---------------------------------------------------------------------------------------------- */

/**
 * The zone list with `zone` pinned, or unchanged when the runtime does not know
 * that name or it is already pinned.
 *
 * This is the "on the way in" half of the validation: nothing the platform would
 * reject is ever written, so the refusal path below exists only for a record
 * that outlived a runtime update.
 */
export function withZone(
  zones: ReadonlyArray<string>,
  zone: string,
): ReadonlyArray<string> {
  if (!isKnownTimeZone(zone) || zones.includes(zone)) return zones
  return [...zones, zone]
}

/** The zone list without `zone`, valid or not — a refusal row is removable. */
export function withoutZone(
  zones: ReadonlyArray<string>,
  zone: string,
): ReadonlyArray<string> {
  return zones.filter((pinned) => pinned !== zone)
}

/* -------------------------------------------------------------------------------------------------
 * Reading a zone
 * ---------------------------------------------------------------------------------------------- */

/** One row of the clock: what to draw, or that there is nothing to draw. */
export type ZoneReading =
  | {
      readonly ok: true
      readonly zone: string
      /** The city, derived from the identifier rather than from a table. */
      readonly label: string
      /** Signed minutes this zone is ahead of the reader's own. */
      readonly offsetMinutes: number
    }
  | { readonly ok: false; readonly zone: string }

/**
 * Every pinned zone as a row, ordered by how far ahead of the reader it is and
 * then by name, so the column reads top to bottom as the day moves.
 *
 * A name the runtime will not format never reaches a formatter: it is answered
 * with a refusal the widget renders as an alert, rather than being handed to one
 * that throws a `RangeError` and takes the dashboard down with it. Refusals sort
 * last — they are a fault to clear, not part of the reading.
 *
 * `today` fixes the instant the offsets are computed against, because the answer
 * moves: a zone that is `-300` in January is `-240` in July.
 */
export function readZones(
  zones: ReadonlyArray<string>,
  homeZone: string,
  today: string,
): ReadonlyArray<ZoneReading> {
  const home = timeZoneOffsetMinutes(homeZone, today)
  const readable: Array<Extract<ZoneReading, { ok: true }>> = []
  const refused: Array<Extract<ZoneReading, { ok: false }>> = []

  for (const zone of zones) {
    if (!isFormattableZone(zone)) {
      refused.push({ ok: false, zone })
      continue
    }
    readable.push({
      ok: true,
      zone,
      label: timeZoneCity(zone),
      offsetMinutes: timeZoneOffsetMinutes(zone, today) - home,
    })
  }

  readable.sort(
    (a, b) =>
      a.offsetMinutes - b.offsetMinutes || a.label.localeCompare(b.label),
  )
  refused.sort((a, b) => a.zone.localeCompare(b.zone))
  return [...readable, ...refused]
}

/**
 * `+5:30`, `-8`, `±0` — how far ahead of the reader a row is.
 *
 * Minutes are printed only when there are any, so the twenty-odd zones that need
 * them get them and the rest are not padded with a precision nobody asked for.
 * The sign is always shown, because the figure is a comparison and an unsigned
 * `8` would read as an hour of the day in a column of hours of the day.
 */
export function offsetLabel(minutes: number): string {
  if (minutes === 0) return '±0'
  const sign = minutes < 0 ? '-' : '+'
  const magnitude = Math.abs(minutes)
  const hours = Math.trunc(magnitude / 60)
  const rest = magnitude % 60
  return rest === 0
    ? `${sign}${hours}`
    : `${sign}${hours}:${String(rest).padStart(2, '0')}`
}

const clockFormatters = new Map<string, Intl.DateTimeFormat>()

/**
 * The wall clock in a zone, in the reader's own locale.
 *
 * Hours and minutes only. Seconds would make the widget a per-second render for
 * the life of the page, which is a wasted frame every second in exchange for a
 * digit nobody is watching.
 *
 * `null` for a name the runtime will not format, so this shares the refusal path
 * with {@link readZones} rather than throwing inside a formatter.
 */
export function zoneClockTime(
  zone: string,
  atMs: number,
  locale: string,
): string | null {
  if (!isFormattableZone(zone)) return null
  const cacheKey = `${locale} ${zone}`
  let formatter = clockFormatters.get(cacheKey)
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat(locale, {
      timeZone: zone,
      hour: 'numeric',
      minute: '2-digit',
    })
    clockFormatters.set(cacheKey, formatter)
  }
  return formatter.format(new Date(atMs))
}

/* -------------------------------------------------------------------------------------------------
 * The tick
 * ---------------------------------------------------------------------------------------------- */

const MINUTE_MS = 60_000

/**
 * How long until the next whole minute.
 *
 * A fixed `60_000` would be wrong within a page's lifetime rather than
 * eventually: the first tick lands wherever the mount happened to fall inside
 * the minute, and every later one inherits that offset plus whatever the timer
 * itself drifts — so a clock mounted at `:59.7` shows the wrong minute for
 * almost the whole of every minute it is up. Recomputing the delay after each
 * tick re-aligns it instead.
 */
export function millisecondsToNextMinute(atMs: number): number {
  const past = atMs % MINUTE_MS
  return past === 0 ? MINUTE_MS : MINUTE_MS - past
}
