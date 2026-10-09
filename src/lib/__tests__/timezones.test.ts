/**
 * The zone list and the local-clock label.
 *
 * Three claims, and each of them is the reason the module exists rather than a
 * restatement of what `Intl` does:
 *
 * 1. **Every zone the list offers is a zone the app can store.** The list comes
 *    from the platform and the validation comes from `src/lib/time.ts`; nothing
 *    guarantees the two agree except an assertion that walks all 400-odd of them.
 *    A picker that can produce a value `resolveTimeZone` silently rewrites to
 *    `UTC` is worse than no picker.
 * 2. **The label is a function of the instant, not of when it is rendered.** A
 *    departure from Paris in July is on `UTC+2` and the same clock time in
 *    January is on `UTC+1`, so the label is computed against the date the time is
 *    on and is byte-stable for a fixed one.
 * 3. **A zone the platform does not know degrades.** Zone names arrive from the
 *    database and from a catalogue cut months ago; a `RangeError` out of a label
 *    formatter would take a whole dialog down.
 */
import { describe, expect, it } from 'vitest'

import { FALLBACK_TIME_ZONE, resolveTimeZone } from '#/lib/time'
import {
  TIME_ZONES,
  hourIn,
  isKnownTimeZone,
  localClockLabel,
  timeZoneOffsetLabel,
  timeZoneOptions,
  timeZoneRegion,
} from '#/lib/timezones'

describe('the enumerated zone list', () => {
  it('is a long list of IANA names and holds no duplicates', () => {
    expect(TIME_ZONES.length).toBeGreaterThan(300)
    expect(new Set(TIME_ZONES).size).toBe(TIME_ZONES.length)
    expect(TIME_ZONES).toContain('Asia/Tokyo')
    expect(TIME_ZONES).toContain('Europe/Lisbon')
  })

  it('is sorted, so two builds of the picker read the same', () => {
    expect([...TIME_ZONES].sort()).toEqual([...TIME_ZONES])
  })

  /**
   * The claim that makes the picker safe: every value it can produce survives
   * the validator every write goes through, unchanged.
   */
  it('offers nothing `resolveTimeZone` would rewrite', () => {
    const rewritten = TIME_ZONES.filter(
      (zone) => resolveTimeZone(zone) !== zone,
    )
    expect(rewritten).toEqual([])
  })

  it('answers `isKnownTimeZone` for its own members and for nothing else', () => {
    expect(isKnownTimeZone('Asia/Tokyo')).toBe(true)
    expect(isKnownTimeZone('Mars/Olympus_Mons')).toBe(false)
    expect(isKnownTimeZone('')).toBe(false)
    expect(isKnownTimeZone(null)).toBe(false)
  })
})

describe('the region a zone is grouped under', () => {
  it('is the part before the first slash', () => {
    expect(timeZoneRegion('Asia/Tokyo')).toBe('Asia')
    expect(timeZoneRegion('America/Argentina/Ushuaia')).toBe('America')
  })

  it('files a zone with no slash under “Other”', () => {
    expect(timeZoneRegion('UTC')).toBe('Other')
  })

  it('gives every option a group, a value and a label', () => {
    const options = timeZoneOptions('2026-07-15')
    expect(options).toHaveLength(TIME_ZONES.length)

    const tokyo = options.find((option) => option.value === 'Asia/Tokyo')
    expect(tokyo).toEqual({
      value: 'Asia/Tokyo',
      label: 'Tokyo',
      description: 'UTC+9',
      group: 'Asia',
    })
    expect(options.every((option) => option.group.length > 0)).toBe(true)
  })
})

describe('the offset label', () => {
  /** Fixed dates, so these are assertions rather than a reading of today. */
  it('is stable for a fixed instant in a known zone', () => {
    expect(timeZoneOffsetLabel('Asia/Tokyo', '2026-07-15')).toBe('UTC+9')
    expect(timeZoneOffsetLabel('Asia/Tokyo', '2026-01-15')).toBe('UTC+9')
    expect(timeZoneOffsetLabel('Asia/Kolkata', '2026-01-15')).toBe('UTC+5:30')
    expect(timeZoneOffsetLabel('Pacific/Chatham', '2026-01-15')).toBe(
      'UTC+13:45',
    )
    expect(timeZoneOffsetLabel('America/Los_Angeles', '2026-01-15')).toBe(
      'UTC-8',
    )
    expect(timeZoneOffsetLabel('UTC', '2026-01-15')).toBe('UTC')
  })

  /** The whole reason the date is a parameter: the same zone, two answers. */
  it('follows the season the date is in', () => {
    expect(timeZoneOffsetLabel('Europe/Paris', '2026-01-15')).toBe('UTC+1')
    expect(timeZoneOffsetLabel('Europe/Paris', '2026-07-15')).toBe('UTC+2')
  })

  it('falls back rather than throwing on a zone the platform rejects', () => {
    expect(timeZoneOffsetLabel('Mars/Olympus_Mons', '2026-01-15')).toBe(
      timeZoneOffsetLabel(FALLBACK_TIME_ZONE, '2026-01-15'),
    )
    expect(timeZoneOffsetLabel('', '2026-01-15')).toBe('UTC')
  })

  it('reads an unparseable date as no date at all rather than as NaN', () => {
    expect(timeZoneOffsetLabel('Asia/Tokyo', 'not-a-date')).toBe('UTC+9')
  })
})

describe('the local-clock label under a time input', () => {
  it('says the clock, the zone and the offset', () => {
    expect(
      localClockLabel({
        time: '14:05',
        timezone: 'Asia/Tokyo',
        date: '2026-07-15',
      }),
    ).toBe('14:05 · Asia/Tokyo (UTC+9)')
  })

  it('says the zone alone while no time has been typed', () => {
    expect(
      localClockLabel({ time: '', timezone: 'Asia/Tokyo', date: '2026-07-15' }),
    ).toBe('Asia/Tokyo (UTC+9)')
  })

  /**
   * No zone is the honest answer for an endpoint the traveller has not resolved,
   * and it must not be dressed up as UTC — the reader would take that for a
   * statement about the departure rather than for the absence of one.
   */
  it('says nothing at all when the endpoint names no zone', () => {
    expect(
      localClockLabel({ time: '14:05', timezone: '', date: '' }),
    ).toBeNull()
    expect(
      localClockLabel({ time: '14:05', timezone: null, date: null }),
    ).toBeNull()
  })

  it('degrades to the fallback zone rather than throwing on an unknown one', () => {
    expect(
      localClockLabel({
        time: '14:05',
        timezone: 'Mars/Olympus_Mons',
        date: '2026-07-15',
      }),
    ).toBe('14:05 · Mars/Olympus_Mons (UTC)')
  })
})

describe('hourIn', () => {
  it('reads the hour of an instant on the wall clock of the zone', () => {
    // 22:00Z on 13 October is midnight in Oslo (UTC+2) and 11:00 the next day in Auckland (UTC+13).
    expect(hourIn('2026-10-13T22:00:00Z', 'Europe/Oslo')).toBe(0)
    expect(hourIn('2026-10-13T22:00:00Z', 'Pacific/Auckland')).toBe(11)
    expect(hourIn('2026-10-13T22:00:00Z', 'UTC')).toBe(22)
  })

  it('answers 0, never 24, for the first hour of a day', () => {
    expect(hourIn('2026-10-14T00:30:00Z', 'UTC')).toBe(0)
  })

  it('follows a zone’s own offset on the date, not a fixed one', () => {
    // Oslo is UTC+1 in winter and UTC+2 in summer.
    expect(hourIn('2026-01-15T12:00:00Z', 'Europe/Oslo')).toBe(13)
    expect(hourIn('2026-07-15T12:00:00Z', 'Europe/Oslo')).toBe(14)
  })

  it('reads a half-hour zone by its whole hour', () => {
    // 18:30Z is 00:00 in Kolkata (UTC+5:30), so the hour is 0 and the day has just begun.
    expect(hourIn('2026-10-13T18:30:00Z', 'Asia/Kolkata')).toBe(0)
    expect(hourIn('2026-10-13T18:29:00Z', 'Asia/Kolkata')).toBe(23)
  })
})
