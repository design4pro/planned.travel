import { describe, expect, it, vi } from 'vitest'

import {
  DASHBOARD_WIDGET_IDS,
  dashboardWidgetPreference,
  millisecondsToNextMinute,
  offsetLabel,
  readZones,
  withZone,
  withoutZone,
  zoneClockTime,
} from '../clock-zones'

/**
 * A winter day and a summer day, so every offset assertion here states which
 * side of a transition it is on. Both are fixed strings rather than "today":
 * a test that reads the wall calendar passes until the calendar moves.
 */
const WINTER = '2026-01-15'
const SUMMER = '2026-07-15'

describe('the preference declaration', () => {
  it('is a local preference, so a folded widget is still folded tomorrow', () => {
    // The mutation this holds: `session` here would make a reader re-hide the
    // same widget every morning, which is a chore and not a preference.
    expect(dashboardWidgetPreference.area).toBe('local')
    expect(dashboardWidgetPreference.key).toBe('planned.dashboard-widgets')
  })

  it('starts with every widget shown and no zone chosen', () => {
    expect(dashboardWidgetPreference.fallback).toEqual({
      shown: DASHBOARD_WIDGET_IDS,
      zones: null,
    })
  })
})

describe('the stored record', () => {
  /** The guard, reached the way the module reaches it: through a real write. */
  function roundTrip(stored: unknown): unknown {
    localStorage.setItem(dashboardWidgetPreference.key, JSON.stringify(stored))
    return dashboardWidgetPreference.read()
  }

  it('drops a widget id it does not know and keeps the ones it does', () => {
    expect(roundTrip({ shown: ['clock', 'converter'], zones: [] })).toEqual({
      shown: ['clock'],
      zones: [],
    })
  })

  it('keeps a zone the runtime no longer knows, so it can be removed', () => {
    // Dropping it here would make the row vanish with no explanation; the widget
    // shows an alert instead, and the alert needs the name to show.
    expect(roundTrip({ shown: ['clock'], zones: ['Europe/Atlantis'] })).toEqual(
      { shown: ['clock'], zones: ['Europe/Atlantis'] },
    )
  })

  it('tells "never chosen" apart from "emptied"', () => {
    expect(roundTrip({ shown: [], zones: null })).toEqual({
      shown: [],
      zones: null,
    })
    expect(roundTrip({ shown: [], zones: [] })).toEqual({
      shown: [],
      zones: [],
    })
  })

  it('falls back when the payload is not a record it can read', () => {
    expect(roundTrip(['clock'])).toEqual(dashboardWidgetPreference.fallback)
    expect(roundTrip({ shown: 'clock', zones: null })).toEqual(
      dashboardWidgetPreference.fallback,
    )
  })
})

describe('pinning a zone', () => {
  it('refuses a name the runtime does not know, before any Intl call', () => {
    // The refusal is the assertion, and so is the silence: a name that reached
    // `Intl.DateTimeFormat` would throw a RangeError rather than be turned away.
    const format = vi.spyOn(Intl, 'DateTimeFormat')
    expect(withZone([], 'Europe/Atlantis')).toEqual([])
    expect(format).not.toHaveBeenCalled()
    format.mockRestore()
  })

  it('pins a name the runtime knows, once', () => {
    expect(withZone([], 'Asia/Tokyo')).toEqual(['Asia/Tokyo'])
    expect(withZone(['Asia/Tokyo'], 'Asia/Tokyo')).toEqual(['Asia/Tokyo'])
  })

  it('unpins a name whether the runtime knows it or not', () => {
    expect(
      withoutZone(['Asia/Tokyo', 'Europe/Atlantis'], 'Europe/Atlantis'),
    ).toEqual(['Asia/Tokyo'])
    expect(withoutZone(['Asia/Tokyo'], 'Asia/Tokyo')).toEqual([])
  })
})

describe('reading the pinned zones', () => {
  it('derives the label from the identifier rather than from a city table', () => {
    // The three shapes a checked-in table gets wrong: an underscore, a
    // three-segment name, and a zone with no region at all. The rule is the
    // picker's own (`timeZoneCity`), so one label rule holds across the product
    // — everything after the first segment, which is why the three-segment name
    // keeps the country that tells two Córdobas apart.
    const rows = readZones(
      ['America/Argentina/Buenos_Aires', 'Asia/Kolkata', 'UTC'],
      'UTC',
      WINTER,
    )
    expect(rows.map((row) => (row.ok ? row.label : row.zone))).toEqual([
      'Argentina/Buenos Aires',
      'UTC',
      'Kolkata',
    ])
  })

  it('draws a valid name its own picker does not list, rather than alarming', () => {
    // Two alias pairs. Every engine formats all four and lists only one of each
    // pair — which one depends on its ICU build — so this holds without naming
    // the engine. The mutation it catches: gating the reading on the picker's
    // list rather than on what the runtime will format shows the reader an
    // error about a row that draws perfectly well.
    for (const zone of [
      'Asia/Kolkata',
      'Asia/Calcutta',
      'America/Argentina/Buenos_Aires',
      'America/Buenos_Aires',
    ]) {
      expect(readZones([zone], 'UTC', WINTER)[0]).toMatchObject({ ok: true })
    }
  })

  it('signs the offset against the reader and gets half hours right', () => {
    // Kolkata is UTC+5:30 all year; New York is UTC-5 in January. Read from
    // New York the gap is 10:30, and an implementation rounding to whole hours
    // answers 10 or 11.
    const [kolkata] = readZones(['Asia/Kolkata'], 'America/New_York', WINTER)
    expect(kolkata).toEqual({
      ok: true,
      zone: 'Asia/Kolkata',
      label: 'Kolkata',
      offsetMinutes: 630,
    })

    // And the quarter-hour case, which is where an hours-only field truncates.
    const [eucla] = readZones(['Australia/Eucla'], 'UTC', WINTER)
    expect(eucla).toEqual({
      ok: true,
      zone: 'Australia/Eucla',
      label: 'Eucla',
      offsetMinutes: 525,
    })
  })

  it('reads the offset on the day asked about, not on the day it runs', () => {
    // Paris is UTC+1 in January and UTC+2 in July; a reading pinned to one
    // instant would answer the same on both.
    const winter = readZones(['Europe/Paris'], 'UTC', WINTER)[0]
    const summer = readZones(['Europe/Paris'], 'UTC', SUMMER)[0]
    expect(winter.ok && winter.offsetMinutes).toBe(60)
    expect(summer.ok && summer.offsetMinutes).toBe(120)
  })

  it('sorts by offset and then by label', () => {
    // Kolkata (+5:30) after London (0) by offset; Berlin before Paris, which
    // share an offset, by label.
    const rows = readZones(
      ['Asia/Kolkata', 'Europe/Paris', 'Europe/London', 'Europe/Berlin'],
      'Europe/London',
      WINTER,
    )
    expect(rows.map((row) => (row.ok ? row.label : row.zone))).toEqual([
      'London',
      'Berlin',
      'Paris',
      'Kolkata',
    ])
  })

  it('refuses an unknown zone instead of formatting it, and sorts it last', () => {
    const rows = readZones(['Europe/Atlantis', 'Asia/Tokyo'], 'UTC', WINTER)
    expect(rows).toEqual([
      { ok: true, zone: 'Asia/Tokyo', label: 'Tokyo', offsetMinutes: 540 },
      { ok: false, zone: 'Europe/Atlantis' },
    ])
  })
})

describe('the offset line', () => {
  it('prints minutes only when there are any, and always a sign', () => {
    expect(offsetLabel(0)).toBe('±0')
    expect(offsetLabel(540)).toBe('+9')
    expect(offsetLabel(330)).toBe('+5:30')
    expect(offsetLabel(-480)).toBe('-8')
    expect(offsetLabel(-570)).toBe('-9:30')
    expect(offsetLabel(525)).toBe('+8:45')
  })
})

describe('the wall clock in a zone', () => {
  it('formats hours and minutes, and nothing finer', () => {
    const noonUtc = Date.parse('2026-01-15T12:00:00.000Z')
    expect(zoneClockTime('Asia/Tokyo', noonUtc, 'en-GB')).toBe('21:00')
    expect(zoneClockTime('Asia/Kolkata', noonUtc, 'en-GB')).toBe('17:30')
  })

  it('answers null for a zone the runtime does not know', () => {
    expect(zoneClockTime('Europe/Atlantis', 0, 'en-GB')).toBeNull()
  })
})

describe('the tick', () => {
  it('is the delay to the next minute boundary, not a fixed minute', () => {
    // The mutation this holds: a fixed 60_000 answers 60_000 for every input,
    // so a clock mounted at :59.7 is a whole minute stale for a whole minute.
    const minute = 60_000
    expect(
      millisecondsToNextMinute(Date.parse('2026-01-15T12:00:59.700Z')),
    ).toBe(300)
    expect(
      millisecondsToNextMinute(Date.parse('2026-01-15T12:00:00.001Z')),
    ).toBe(minute - 1)
    expect(
      millisecondsToNextMinute(Date.parse('2026-01-15T12:00:30.000Z')),
    ).toBe(minute / 2)
  })

  it('waits a whole minute when it is already on the boundary', () => {
    // Zero would be a timer that fires immediately and never advances.
    expect(
      millisecondsToNextMinute(Date.parse('2026-01-15T12:00:00.000Z')),
    ).toBe(60_000)
  })
})
