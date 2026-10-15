import { describe, expect, it } from 'vitest'

import {
  parseIcsCalendar,
  parseIcsProperty,
  unescapeIcsText,
  unfoldIcsLines,
} from '#/server/queue/ics'
import { escapeIcsText, foldIcsLine, writeCalendar } from '../ics'
import type { IcsEventInput } from '../ics'

const STAMP = new Date('2026-04-01T08:30:00.000Z')

function event(overrides: Partial<IcsEventInput> = {}): IcsEventInput {
  return {
    uid: 'stop-abc@planned.travel',
    stamp: STAMP,
    start: { kind: 'floating', date: '2026-04-10', time: '09:30' },
    summary: 'Miradouro',
    ...overrides,
  }
}

function build(events: ReadonlyArray<IcsEventInput>, name = 'Lisbon'): string {
  return writeCalendar({ name, events })
}

/** The content lines of a calendar, unfolded: what a reader sees. */
function lines(text: string): Array<string> {
  return unfoldIcsLines(text)
}

const encoder = new TextEncoder()
const octets = (value: string): number => encoder.encode(value).length

describe('escapeIcsText', () => {
  it('escapes backslash, semicolon, comma and newlines', () => {
    expect(escapeIcsText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne')
  })

  it.each(['\r\n', '\r', '\n'])(
    'turns the line break %j into one escaped newline',
    (lineBreak) => {
      expect(escapeIcsText(`one${lineBreak}two`)).toBe('one\\ntwo')
    },
  )

  it('drops control characters that have no place in a content line', () => {
    expect(escapeIcsText('a\u0000b\u0007c\u007fd')).toBe('abcd')
  })
})

describe('foldIcsLine', () => {
  it('leaves a short line alone', () => {
    expect(foldIcsLine('SUMMARY:short')).toBe('SUMMARY:short')
  })

  it('folds at 75 octets with a CRLF and one space', () => {
    const folded = foldIcsLine(`SUMMARY:${'a'.repeat(200)}`)
    const physical = folded.split('\r\n')

    expect(physical.length).toBeGreaterThan(1)
    for (const [index, line] of physical.entries()) {
      expect(octets(line)).toBeLessThanOrEqual(75)
      if (index > 0) {
        expect(line.startsWith(' ')).toBe(true)
      }
    }
    expect(unfoldIcsLines(folded)).toEqual([`SUMMARY:${'a'.repeat(200)}`])
  })

  it('never splits a multi-byte character across two lines', () => {
    // "SUMMARY:" is 8 octets; 66 ASCII octets reach octet 74, so the two-octet "é" that follows
    // straddles octet 75 and must move whole to the next line.
    const value = `${'a'.repeat(66)}é${'b'.repeat(20)}`
    const folded = foldIcsLine(`SUMMARY:${value}`)

    for (const line of folded.split('\r\n')) {
      expect(octets(line)).toBeLessThanOrEqual(75)
      expect(line).not.toContain('�')
    }
    expect(unfoldIcsLines(folded)).toEqual([`SUMMARY:${value}`])
  })

  it('keeps a four-octet character together', () => {
    const value = '🧭'.repeat(40)
    const folded = foldIcsLine(`SUMMARY:${value}`)

    expect(unfoldIcsLines(folded)).toEqual([`SUMMARY:${value}`])
    for (const line of folded.split('\r\n')) {
      expect(octets(line)).toBeLessThanOrEqual(75)
    }
  })
})

describe('writeCalendar', () => {
  it('opens and closes one VCALENDAR with CRLF line ends', () => {
    const text = build([event()])

    expect(text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
  })

  it('writes the calendar properties and the refresh hints', () => {
    const text = lines(build([], 'Lisbon in spring'))

    expect(text).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//planned.travel//Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Lisbon in spring',
      'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
      'X-PUBLISHED-TTL:PT1H',
      'END:VCALENDAR',
    ])
  })

  it('never writes a VTIMEZONE', () => {
    const text = build([
      event({
        start: { kind: 'utc', at: new Date('2026-04-10T00:00:00Z') },
      }),
    ])

    expect(text).not.toContain('VTIMEZONE')
    expect(text).not.toContain('TZID')
  })

  it('writes an all-day event with VALUE=DATE', () => {
    const text = lines(
      build([
        event({
          start: { kind: 'date', date: '2026-04-10' },
          end: { kind: 'date', date: '2026-04-13' },
        }),
      ]),
    )

    expect(text).toContain('DTSTART;VALUE=DATE:20260410')
    expect(text).toContain('DTEND;VALUE=DATE:20260413')
  })

  it('writes a floating time with neither a Z nor a zone', () => {
    const text = lines(
      build([
        event({
          start: { kind: 'floating', date: '2026-04-10', time: '09:30' },
          end: { kind: 'floating', date: '2026-04-10', time: '10:30' },
        }),
      ]),
    )

    expect(text).toContain('DTSTART:20260410T093000')
    expect(text).toContain('DTEND:20260410T103000')
  })

  it('writes a UTC instant with a Z', () => {
    const text = lines(
      build([
        event({
          start: { kind: 'utc', at: new Date('2026-04-10T00:00:00Z') },
          end: { kind: 'utc', at: new Date('2026-04-10T11:25:00Z') },
        }),
      ]),
    )

    expect(text).toContain('DTSTART:20260410T000000Z')
    expect(text).toContain('DTEND:20260410T112500Z')
  })

  it('stamps DTSTAMP and LAST-MODIFIED from the event, never from the clock', () => {
    const text = lines(build([event()]))

    expect(text).toContain('DTSTAMP:20260401T083000Z')
    expect(text).toContain('LAST-MODIFIED:20260401T083000Z')
  })

  it('omits the optional properties that are not given', () => {
    const text = lines(build([event()]))

    for (const name of ['DTEND', 'DESCRIPTION', 'LOCATION', 'URL', 'STATUS']) {
      expect(text.some((line) => line.startsWith(name))).toBe(false)
    }
  })

  it('writes the optional properties when given', () => {
    const text = lines(
      build([
        event({
          description: 'Bring water',
          location: 'Rua Augusta 1, Lisboa',
          url: 'https://app.planned.travel/trips/trip-1',
          status: 'TENTATIVE',
        }),
      ]),
    )

    expect(text).toContain('DESCRIPTION:Bring water')
    expect(text).toContain('LOCATION:Rua Augusta 1\\, Lisboa')
    expect(text).toContain('URL:https://app.planned.travel/trips/trip-1')
    expect(text).toContain('STATUS:TENTATIVE')
  })

  it('is byte-identical for the same input', () => {
    const events = [event(), event({ uid: 'stop-def@planned.travel' })]

    expect(build(events)).toBe(build(events))
  })

  describe('content-line injection', () => {
    it.each([
      ['CRLF', 'Dinner\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:injected'],
      ['bare LF', 'Dinner\nEND:VEVENT'],
      ['bare CR', 'Dinner\rEND:VEVENT'],
    ])('a title containing %s yields no new content line', (_name, title) => {
      const text = lines(build([event({ summary: title })]))

      expect(text.filter((line) => line === 'END:VEVENT')).toHaveLength(1)
      expect(text.filter((line) => line === 'BEGIN:VEVENT')).toHaveLength(1)
      expect(text.filter((line) => line.startsWith('SUMMARY'))).toHaveLength(1)
    })

    it('keeps a line break in the calendar name, a location or a URL from starting a line', () => {
      const text = lines(
        build(
          [
            event({
              location: 'Pier 3\r\nATTENDEE:mailto:x@example.test',
              url: 'https://x.test/\r\nBEGIN:VALARM',
              uid: 'stop-1@planned.travel\r\nATTACH:evil',
            }),
          ],
          'Trip\r\nX-INJECT:yes',
        ),
      )

      expect(text.some((line) => line.startsWith('ATTENDEE'))).toBe(false)
      expect(text.some((line) => line.startsWith('X-INJECT'))).toBe(false)
      expect(text.some((line) => line.startsWith('ATTACH'))).toBe(false)
      expect(text.some((line) => line === 'BEGIN:VALARM')).toBe(false)
    })
  })

  describe('round trip through the booking-import reader', () => {
    it('reads back the text, the dates and the flags the writer wrote', () => {
      const text = build([
        event({
          summary: 'Lunch, with a view; "quoted" \\ slash',
          description: 'Line one\nLine two',
          location: 'Rua Augusta 1, Lisboa',
          url: 'https://app.planned.travel/trips/trip-1',
          start: { kind: 'floating', date: '2026-04-10', time: '12:00' },
          end: { kind: 'floating', date: '2026-04-10', time: '13:30' },
        }),
        event({
          uid: 'leg-1@planned.travel',
          summary: 'Warsaw → Tokyo',
          start: { kind: 'utc', at: new Date('2026-04-10T00:00:00Z') },
          end: { kind: 'utc', at: new Date('2026-04-10T11:25:00Z') },
        }),
        event({
          uid: 'trip-1@planned.travel',
          summary: 'Lisbon',
          start: { kind: 'date', date: '2026-04-10' },
          end: { kind: 'date', date: '2026-04-13' },
        }),
      ])

      const [lunch, flight, trip] = parseIcsCalendar(text)

      expect(lunch).toMatchObject({
        uid: 'stop-abc@planned.travel',
        summary: 'Lunch, with a view; "quoted" \\ slash',
        description: 'Line one\nLine two',
        location: 'Rua Augusta 1, Lisboa',
        url: 'https://app.planned.travel/trips/trip-1',
        start: '2026-04-10T12:00:00',
        end: '2026-04-10T13:30:00',
        allDay: false,
        floating: true,
      })
      expect(flight).toMatchObject({
        uid: 'leg-1@planned.travel',
        summary: 'Warsaw → Tokyo',
        start: '2026-04-10T00:00:00Z',
        end: '2026-04-10T11:25:00Z',
        allDay: false,
        floating: false,
      })
      expect(trip).toMatchObject({
        start: '2026-04-10',
        end: '2026-04-13',
        allDay: true,
      })
    })

    it('reads back a long multi-byte title that had to be folded', () => {
      const title = `Café ${'日本語の旅程 '.repeat(20)}end`

      const [parsed] = parseIcsCalendar(build([event({ summary: title })]))

      expect(parsed?.summary).toBe(title.trim())
    })

    it('reads the calendar name with the shared property parser', () => {
      const name = lines(build([], 'Lisbon, in spring')).find((line) =>
        line.startsWith('X-WR-CALNAME'),
      )
      const property = parseIcsProperty(name ?? '')

      expect(unescapeIcsText(property?.value ?? '')).toBe('Lisbon, in spring')
    })
  })
})
