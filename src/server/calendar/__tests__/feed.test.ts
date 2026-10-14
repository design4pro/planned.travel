import { describe, expect, it } from 'vitest'

import { unfoldIcsLines } from '#/server/queue/ics'
import { buildCalendar } from '../feed'
import type {
  FeedDay,
  FeedDayNote,
  FeedLeg,
  FeedPlace,
  FeedReservation,
  FeedSource,
  FeedStay,
  FeedStop,
  FeedTransport,
  FeedTrip,
} from '../feed'

/* -------------------------------------------------------------------------------------------------
 * Fixtures: each factory is a complete, valid row and a test overrides only what it is about.
 * ---------------------------------------------------------------------------------------------- */

const EDITED = new Date('2026-04-01T08:00:00.000Z')
const BASE_URL = 'https://app.planned.travel'

const trip = (o: Partial<FeedTrip> = {}): FeedTrip => ({
  id: 'trip1',
  title: 'Lisbon in spring',
  summary: null,
  startDate: '2026-04-10',
  endDate: '2026-04-12',
  updatedAt: EDITED,
  ...o,
})

const day = (o: Partial<FeedDay> = {}): FeedDay => ({
  id: 'day1',
  tripId: 'trip1',
  dayNumber: 1,
  date: '2026-04-10',
  title: null,
  updatedAt: EDITED,
  ...o,
})

const place = (o: Partial<FeedPlace> = {}): FeedPlace => ({
  id: 'place1',
  tripId: 'trip1',
  name: 'Miradouro',
  address: 'Largo da Senhora do Monte, Lisboa',
  durationMinutes: 60,
  updatedAt: EDITED,
  ...o,
})

const stop = (o: Partial<FeedStop> = {}): FeedStop => ({
  id: 'stop1',
  tripId: 'trip1',
  dayId: 'day1',
  placeId: 'place1',
  orderIndex: 0,
  startTime: '09:30',
  endTime: null,
  durationMinutes: null,
  notes: null,
  updatedAt: EDITED,
  ...o,
})

const dayNote = (o: Partial<FeedDayNote> = {}): FeedDayNote => ({
  id: 'note1',
  tripId: 'trip1',
  dayId: 'day1',
  body: 'Buy the transit pass',
  detail: null,
  time: null,
  sortOrder: 0,
  updatedAt: EDITED,
  ...o,
})

const stay = (o: Partial<FeedStay> = {}): FeedStay => ({
  id: 'stay1',
  tripId: 'trip1',
  startDayId: 'day1',
  endDayId: 'day3',
  reservationId: null,
  name: 'Alfama guesthouse',
  address: 'Rua de São Tomé 1, Lisboa',
  checkInTime: null,
  checkOutTime: null,
  updatedAt: EDITED,
  ...o,
})

const transport = (o: Partial<FeedTransport> = {}): FeedTransport => ({
  id: 'transport1',
  tripId: 'trip1',
  dayId: null,
  status: 'confirmed',
  title: 'Flight to Lisbon',
  serviceNumber: null,
  departureName: 'Warsaw Chopin',
  departureDate: '2026-04-10',
  departureTime: '07:05',
  departureTimezone: 'Europe/Warsaw',
  arrivalDate: '2026-04-10',
  arrivalTime: '10:20',
  arrivalTimezone: 'Europe/Lisbon',
  updatedAt: EDITED,
  ...o,
})

const leg = (o: Partial<FeedLeg> = {}): FeedLeg => ({
  id: 'leg1',
  tripId: 'trip1',
  transportId: 'transport1',
  position: 0,
  fromName: 'Warsaw',
  fromTimezone: 'Europe/Warsaw',
  toName: 'Tokyo',
  toTimezone: 'Asia/Tokyo',
  serviceNumber: null,
  departureDayId: null,
  departureDate: '2026-04-10',
  departureTime: '09:00',
  arrivalDate: '2026-04-11',
  arrivalTime: '07:30',
  updatedAt: EDITED,
  ...o,
})

const reservation = (o: Partial<FeedReservation> = {}): FeedReservation => ({
  id: 'res1',
  tripId: 'trip1',
  assignmentId: null,
  transportId: null,
  status: 'confirmed',
  title: 'Dinner at Taberna',
  location: 'Rua do Mundo 3, Lisboa',
  startDate: '2026-04-11',
  startTime: '20:00',
  endDate: null,
  endTime: null,
  updatedAt: EDITED,
  ...o,
})

const DAYS = [
  day(),
  day({ id: 'day2', dayNumber: 2, date: '2026-04-11' }),
  day({ id: 'day3', dayNumber: 3, date: '2026-04-12' }),
]

function source(parts: Partial<FeedSource> = {}): FeedSource {
  return {
    trips: [trip()],
    days: [],
    places: [],
    stops: [],
    dayNotes: [],
    stays: [],
    transports: [],
    legs: [],
    reservations: [],
    ...parts,
  }
}

type EventLines = ReadonlyArray<string>

/** Every `VEVENT` of a calendar as its unfolded content lines, in file order. */
function eventsOf(text: string): Array<EventLines> {
  const found: Array<Array<string>> = []
  let current: Array<string> | null = null
  for (const line of unfoldIcsLines(text)) {
    if (line === 'BEGIN:VEVENT') {
      current = []
    } else if (line === 'END:VEVENT') {
      if (current !== null) found.push(current)
      current = null
    } else if (current !== null) {
      current.push(line)
    }
  }
  return found
}

function build(src: FeedSource, name = 'Lisbon in spring'): string {
  return buildCalendar(src, { name, baseUrl: BASE_URL })
}

function events(src: FeedSource): Array<EventLines> {
  return eventsOf(build(src))
}

/** The one event whose UID starts with `prefix`; fails the test when there is not exactly one. */
function only(src: FeedSource, prefix: string): EventLines {
  const found = events(src).filter((event) =>
    event.some((line) => line.startsWith(`UID:${prefix}`)),
  )
  expect(found).toHaveLength(1)
  return found[0] ?? []
}

const has = (event: EventLines, name: string): boolean =>
  event.some(
    (line) => line.startsWith(`${name}:`) || line.startsWith(`${name};`),
  )

const valueOf = (event: EventLines, name: string): string | undefined => {
  const line = event.find(
    (candidate) =>
      candidate.startsWith(`${name}:`) || candidate.startsWith(`${name};`),
  )
  return line === undefined ? undefined : line.slice(line.indexOf(':') + 1)
}

const uids = (src: FeedSource): Array<string> =>
  events(src).map((event) => valueOf(event, 'UID') ?? '')

/* -------------------------------------------------------------------------------------------------
 * The calendar
 * ---------------------------------------------------------------------------------------------- */

describe('buildCalendar', () => {
  it('names the calendar with the given name', () => {
    expect(build(source(), 'A trip, with a comma')).toContain(
      'X-WR-CALNAME:A trip\\, with a comma\r\n',
    )
  })

  it('is a valid empty calendar for a source with nothing in it', () => {
    const text = build(source({ trips: [] }))

    expect(text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(eventsOf(text)).toEqual([])
  })

  it('never writes a VTIMEZONE or a TZID, whatever the events carry', () => {
    const text = build(
      source({
        days: DAYS,
        places: [place()],
        stops: [stop()],
        transports: [transport()],
        legs: [leg()],
        reservations: [reservation()],
      }),
    )

    expect(text).not.toContain('VTIMEZONE')
    expect(text).not.toContain('TZID')
  })

  it('puts the login-protected address of its trip on every event', () => {
    const second = trip({
      id: 'trip2',
      title: 'Porto',
      startDate: '2026-06-01',
    })
    const text = build(
      source({
        trips: [trip(), second],
        reservations: [reservation({ id: 'res2', tripId: 'trip2' })],
      }),
    )

    for (const event of eventsOf(text)) {
      const url = valueOf(event, 'URL')
      const uid = valueOf(event, 'UID') ?? ''
      expect(url).toMatch(/^https:\/\/app\.planned\.travel\/trips\/trip[12]$/)
      if (uid.startsWith('reservation-res2')) {
        expect(url).toBe(`${BASE_URL}/trips/trip2`)
      }
    }
    expect(eventsOf(text).length).toBeGreaterThanOrEqual(3)
  })

  describe('the trip', () => {
    it('is an all-day event through its last day, inclusive', () => {
      const event = only(
        source({ trips: [trip({ summary: 'Two nights' })] }),
        'trip-trip1@',
      )

      expect(event).toContain('DTSTART;VALUE=DATE:20260410')
      expect(event).toContain('DTEND;VALUE=DATE:20260413')
      expect(event).toContain('SUMMARY:Lisbon in spring')
      expect(event).toContain('DESCRIPTION:Two nights')
    })

    it('is a one-day event, with no end, when only the start date is set', () => {
      const event = only(
        source({ trips: [trip({ endDate: null })] }),
        'trip-trip1@',
      )

      expect(event).toContain('DTSTART;VALUE=DATE:20260410')
      expect(has(event, 'DTEND')).toBe(false)
    })

    it.each([
      ['only an end date', { startDate: null }],
      ['neither date', { startDate: null, endDate: null }],
    ])('has no event with %s', (_name, dates) => {
      expect(uids(source({ trips: [trip(dates)] }))).toEqual([])
    })
  })

  describe('a stop', () => {
    const stopSource = (
      stopOverrides: Partial<FeedStop> = {},
      placeOverrides: Partial<FeedPlace> = {},
    ) =>
      source({
        trips: [trip({ startDate: null, endDate: null })],
        days: DAYS,
        places: [place(placeOverrides)],
        stops: [stop(stopOverrides)],
      })

    it('is a floating local time named for its place, located at the address', () => {
      const event = only(stopSource({ notes: 'Go early' }), 'stop-stop1@')

      expect(event).toContain('DTSTART:20260410T093000')
      expect(event).toContain('SUMMARY:Miradouro')
      expect(event).toContain('LOCATION:Largo da Senhora do Monte\\, Lisboa')
      expect(event).toContain('DESCRIPTION:Go early')
    })

    it('lasts one hour when nothing says otherwise', () => {
      expect(
        valueOf(only(stopSource({}, { durationMinutes: 0 }), 'stop-'), 'DTEND'),
      ).toBe('20260410T103000')
    })

    it('ends at its end time', () => {
      expect(
        valueOf(only(stopSource({ endTime: '18:00' }), 'stop-'), 'DTEND'),
      ).toBe('20260410T180000')
    })

    it('ends after its own duration, else after its place’s', () => {
      expect(
        valueOf(only(stopSource({ durationMinutes: 45 }), 'stop-'), 'DTEND'),
      ).toBe('20260410T101500')
      expect(
        valueOf(
          only(stopSource({}, { durationMinutes: 90 }), 'stop-'),
          'DTEND',
        ),
      ).toBe('20260410T110000')
    })

    it('ends the next day when its end time is earlier than its start', () => {
      expect(
        valueOf(only(stopSource({ endTime: '08:00' }), 'stop-'), 'DTEND'),
      ).toBe('20260411T080000')
    })

    it('rolls a duration past midnight onto the next day', () => {
      expect(
        valueOf(
          only(
            stopSource({ startTime: '23:30', durationMinutes: 60 }),
            'stop-',
          ),
          'DTEND',
        ),
      ).toBe('20260411T003000')
    })

    it('produces nothing on a day with no date', () => {
      expect(
        uids(
          source({
            trips: [trip({ startDate: null, endDate: null })],
            days: [day({ date: null })],
            places: [place()],
            stops: [stop()],
          }),
        ),
      ).toEqual([])
    })

    it('has no event of its own without a start time; the day lists it instead', () => {
      const list = uids(stopSource({ startTime: null }))

      expect(list.some((uid) => uid.startsWith('stop-'))).toBe(false)
      expect(list.some((uid) => uid.startsWith('day-'))).toBe(true)
    })
  })

  describe('a day', () => {
    const daySource = (parts: Partial<FeedSource>) =>
      source({
        trips: [trip({ startDate: null, endDate: null })],
        days: DAYS,
        ...parts,
      })

    it('has no event when it has no title, no note and no untimed stop', () => {
      expect(uids(daySource({}))).toEqual([])
    })

    it('is an all-day event titled by the day', () => {
      const event = only(
        daySource({ days: [day({ title: 'Alfama on foot' })] }),
        'day-day1@',
      )

      expect(event).toContain('SUMMARY:Alfama on foot')
      expect(event).toContain('DTSTART;VALUE=DATE:20260410')
      expect(has(event, 'DTEND')).toBe(false)
    })

    it('falls back to the trip title and the day number, with no invented label', () => {
      const event = only(
        daySource({
          days: [DAYS[1] ?? day()],
          dayNotes: [dayNote({ dayId: 'day2' })],
        }),
        'day-day2@',
      )

      expect(event).toContain('SUMMARY:Lisbon in spring · 2')
    })

    it('lists its untimed stops and its notes in the description', () => {
      const event = only(
        daySource({
          places: [place(), place({ id: 'place2', name: 'Time Out Market' })],
          stops: [
            stop({ startTime: null, orderIndex: 2 }),
            stop({
              id: 'stop2',
              placeId: 'place2',
              startTime: null,
              orderIndex: 1,
            }),
          ],
          dayNotes: [
            dayNote({ body: 'Buy the transit pass' }),
            dayNote({
              id: 'note2',
              body: 'Dinner at 8',
              time: '20:00',
              sortOrder: 1,
            }),
          ],
        }),
        'day-day1@',
      )

      expect(event).toContain(
        'DESCRIPTION:Time Out Market\\nMiradouro\\nBuy the transit pass\\n20:00 Dinner at 8',
      )
    })

    it('does not list a stop that has its own event', () => {
      const text = build(
        daySource({
          days: [day({ title: 'Day one' })],
          places: [place()],
          stops: [stop()],
        }),
      )
      const dayEvent = eventsOf(text).find((event) =>
        event.includes('UID:day-day1@planned.travel'),
      )

      expect(dayEvent).toBeDefined()
      expect(has(dayEvent ?? [], 'DESCRIPTION')).toBe(false)
    })

    it('has no event when the day has no date', () => {
      expect(
        uids(
          daySource({
            days: [day({ date: null, title: 'Somewhere, sometime' })],
          }),
        ),
      ).toEqual([])
    })
  })

  describe('a stay', () => {
    const staySource = (o: Partial<FeedStay> = {}) =>
      source({
        trips: [trip({ startDate: null, endDate: null })],
        days: DAYS,
        stays: [stay(o)],
      })

    it('is all-day from its first day through its check-out day, inclusive', () => {
      const event = only(staySource(), 'stay-stay1@')

      expect(event).toContain('DTSTART;VALUE=DATE:20260410')
      expect(event).toContain('DTEND;VALUE=DATE:20260413')
      expect(event).toContain('SUMMARY:Alfama guesthouse')
      expect(event).toContain('LOCATION:Rua de São Tomé 1\\, Lisboa')
    })

    it('shows both times in the bare form', () => {
      expect(
        valueOf(
          only(
            staySource({ checkInTime: '15:00', checkOutTime: '11:00' }),
            'stay-',
          ),
          'DESCRIPTION',
        ),
      ).toBe('15:00 → 11:00')
    })

    it('shows one time alone when only one is set', () => {
      expect(
        valueOf(
          only(staySource({ checkInTime: '15:00' }), 'stay-'),
          'DESCRIPTION',
        ),
      ).toBe('15:00')
      expect(
        valueOf(
          only(staySource({ checkOutTime: '11:00' }), 'stay-'),
          'DESCRIPTION',
        ),
      ).toBe('11:00')
    })

    it('has no description when neither time is set', () => {
      expect(has(only(staySource(), 'stay-'), 'DESCRIPTION')).toBe(false)
    })

    it('has no event when its first day has no date', () => {
      expect(
        uids(
          source({
            trips: [trip({ startDate: null, endDate: null })],
            days: [day({ date: null }), DAYS[2] ?? day()],
            stays: [stay()],
          }),
        ),
      ).toEqual([])
    })
  })

  describe('a journey', () => {
    const journey = (parts: Partial<FeedSource>) =>
      source({
        trips: [trip({ startDate: null, endDate: null })],
        days: DAYS,
        ...parts,
      })

    it('emits a transport with legs as its legs only, never the transport as well', () => {
      const list = uids(
        journey({
          transports: [transport()],
          legs: [
            leg(),
            leg({
              id: 'leg2',
              position: 1,
              fromName: 'Tokyo',
              toName: 'Kyoto',
            }),
          ],
        }),
      )

      expect(list).toEqual([
        'leg-leg1@planned.travel',
        'leg-leg2@planned.travel',
      ])
    })

    it('puts a leg departing 09:00 in Asia/Tokyo at midnight UTC', () => {
      const event = only(
        journey({
          transports: [transport()],
          legs: [
            leg({
              fromName: 'Tokyo',
              fromTimezone: 'Asia/Tokyo',
              departureTime: '09:00',
              arrivalTime: null,
            }),
          ],
        }),
        'leg-leg1@',
      )

      expect(event).toContain('DTSTART:20260410T000000Z')
    })

    it('uses each endpoint’s own zone, and the offset in force on its date', () => {
      const event = only(
        journey({ transports: [transport()], legs: [leg()] }),
        'leg-leg1@',
      )

      // Warsaw is on summer time on 2026-04-10 (+02:00); Tokyo is +09:00 all year.
      expect(event).toContain('DTSTART:20260410T070000Z')
      expect(event).toContain('DTEND:20260410T223000Z')
    })

    it('is titled from and to, with the service number when it has one, and located at the departure', () => {
      const event = only(
        journey({
          transports: [transport()],
          legs: [leg({ serviceNumber: 'LH 123' })],
        }),
        'leg-leg1@',
      )

      expect(event).toContain('SUMMARY:Warsaw → Tokyo · LH 123')
      expect(event).toContain('LOCATION:Warsaw')
    })

    it('omits the end of a leg with no arrival time', () => {
      expect(
        has(
          only(
            journey({
              transports: [transport()],
              legs: [leg({ arrivalTime: null })],
            }),
            'leg-',
          ),
          'DTEND',
        ),
      ).toBe(false)
    })

    it('writes both ends floating when the arrival zone is unusable', () => {
      const event = only(
        journey({
          transports: [transport()],
          legs: [leg({ toTimezone: 'Mars/Olympus_Mons' })],
        }),
        'leg-',
      )

      expect(event).toContain('DTSTART:20260410T090000')
      expect(event).toContain('DTEND:20260411T073000')
    })

    it('writes both ends floating when the departure zone is missing', () => {
      const event = only(
        journey({
          transports: [transport()],
          legs: [leg({ fromTimezone: null })],
        }),
        'leg-',
      )

      expect(event).toContain('DTSTART:20260410T090000')
      expect(event).toContain('DTEND:20260411T073000')
    })

    it('is an all-day event on the departure date when it has a date and no time', () => {
      const event = only(
        journey({
          transports: [transport()],
          legs: [leg({ departureTime: null, arrivalDate: '2026-04-11' })],
        }),
        'leg-',
      )

      expect(event).toContain('DTSTART;VALUE=DATE:20260410')
      expect(has(event, 'DTEND')).toBe(false)
    })

    it('takes its date from the departure day when the leg has none', () => {
      const event = only(
        journey({
          transports: [transport()],
          legs: [
            leg({
              departureDate: null,
              departureDayId: 'day2',
              departureTime: null,
            }),
          ],
        }),
        'leg-',
      )

      expect(event).toContain('DTSTART;VALUE=DATE:20260411')
    })

    it('has no event for a leg with no date at all', () => {
      expect(
        uids(
          journey({
            transports: [transport()],
            legs: [leg({ departureDate: null, departureDayId: null })],
          }),
        ),
      ).toEqual([])
    })

    it('emits a transport without legs as itself, in its own zones', () => {
      const event = only(
        journey({ transports: [transport()] }),
        'transport-transport1@',
      )

      expect(event).toContain('SUMMARY:Flight to Lisbon')
      expect(event).toContain('LOCATION:Warsaw Chopin')
      expect(event).toContain('DTSTART:20260410T050500Z')
      expect(event).toContain('DTEND:20260410T092000Z')
    })

    it('takes the departure day’s date for a transport that has none of its own', () => {
      const event = only(
        journey({
          transports: [
            transport({
              departureDate: null,
              dayId: 'day2',
              arrivalDate: null,
            }),
          ],
        }),
        'transport-',
      )

      expect(event).toContain('DTSTART:20260411T050500Z')
    })

    it('is all-day with no end when a transport has a date and no time', () => {
      const event = only(
        journey({
          transports: [transport({ departureTime: null, arrivalTime: null })],
        }),
        'transport-',
      )

      expect(event).toContain('DTSTART;VALUE=DATE:20260410')
      expect(has(event, 'DTEND')).toBe(false)
    })

    it('shows nothing for a cancelled transport, with or without legs', () => {
      expect(
        uids(journey({ transports: [transport({ status: 'cancelled' })] })),
      ).toEqual([])
      expect(
        uids(
          journey({
            transports: [transport({ status: 'cancelled' })],
            legs: [leg()],
          }),
        ),
      ).toEqual([])
    })

    it.each([
      ['confirmed', 'CONFIRMED'],
      ['completed', 'CONFIRMED'],
      ['pending', 'TENTATIVE'],
      ['idea', 'TENTATIVE'],
    ])('marks a %s transport %s', (status, expected) => {
      expect(
        valueOf(
          only(journey({ transports: [transport({ status })] }), 'transport-'),
          'STATUS',
        ),
      ).toBe(expected)
    })
  })

  describe('a reservation', () => {
    const reservationSource = (o: Partial<FeedReservation> = {}) =>
      source({
        trips: [trip({ startDate: null, endDate: null })],
        reservations: [reservation(o)],
      })

    it('is a floating timed event when it has a time, even in a trip with no dates', () => {
      const event = only(reservationSource(), 'reservation-res1@')

      expect(event).toContain('DTSTART:20260411T200000')
      expect(event).toContain('SUMMARY:Dinner at Taberna')
      expect(event).toContain('LOCATION:Rua do Mundo 3\\, Lisboa')
      expect(event).toContain('STATUS:CONFIRMED')
      expect(has(event, 'DTEND')).toBe(false)
    })

    it('is all-day when it has no time', () => {
      expect(
        only(reservationSource({ startTime: null }), 'reservation-'),
      ).toContain('DTSTART;VALUE=DATE:20260411')
    })

    it('has no event without a start date', () => {
      expect(uids(reservationSource({ startDate: null }))).toEqual([])
    })

    it('has no event when cancelled', () => {
      expect(uids(reservationSource({ status: 'cancelled' }))).toEqual([])
    })

    it.each([
      ['confirmed', 'CONFIRMED'],
      ['completed', 'CONFIRMED'],
      ['pending', 'TENTATIVE'],
      ['none', 'TENTATIVE'],
    ])('marks a %s reservation %s', (status, expected) => {
      expect(
        valueOf(only(reservationSource({ status }), 'reservation-'), 'STATUS'),
      ).toBe(expected)
    })

    describe('its end', () => {
      it('comes from its end time, on its end date', () => {
        expect(
          valueOf(
            only(
              reservationSource({ endDate: '2026-04-12', endTime: '10:00' }),
              'reservation-',
            ),
            'DTEND',
          ),
        ).toBe('20260412T100000')
      })

      it('falls on the start date when there is an end time and no end date', () => {
        expect(
          valueOf(
            only(reservationSource({ endTime: '22:30' }), 'reservation-'),
            'DTEND',
          ),
        ).toBe('20260411T223000')
      })

      it('moves to the next day when the end time is earlier than the start', () => {
        expect(
          valueOf(
            only(reservationSource({ endTime: '01:00' }), 'reservation-'),
            'DTEND',
          ),
        ).toBe('20260412T010000')
      })

      it('is the day after its end date for an all-day reservation', () => {
        expect(
          valueOf(
            only(
              reservationSource({ startTime: null, endDate: '2026-04-13' }),
              'reservation-',
            ),
            'DTEND',
          ),
        ).toBe('20260414')
      })

      it('is omitted for a timed start with an end date but no end time', () => {
        expect(
          has(
            only(reservationSource({ endDate: '2026-04-13' }), 'reservation-'),
            'DTEND',
          ),
        ).toBe(false)
      })
    })
  })

  describe('a reservation linked to another record', () => {
    const linked = (parts: Partial<FeedSource>) =>
      source({
        trips: [trip({ startDate: null, endDate: null })],
        days: DAYS,
        ...parts,
      })

    it('is one event with its stop, never two', () => {
      const list = uids(
        linked({
          places: [place()],
          stops: [stop()],
          reservations: [reservation({ assignmentId: 'stop1' })],
        }),
      )

      expect(list).toEqual(['stop-stop1@planned.travel'])
    })

    it('gives an untimed stop the reservation’s date and time', () => {
      const event = only(
        linked({
          places: [place()],
          stops: [stop({ startTime: null })],
          reservations: [reservation({ assignmentId: 'stop1' })],
        }),
        'stop-stop1@',
      )

      expect(event).toContain('SUMMARY:Miradouro')
      expect(event).toContain('DTSTART:20260411T200000')
      expect(event).toContain('DTEND:20260411T210000')
    })

    it('keeps a stop’s own time over the reservation’s', () => {
      const event = only(
        linked({
          places: [place()],
          stops: [stop()],
          reservations: [reservation({ assignmentId: 'stop1' })],
        }),
        'stop-',
      )

      expect(event).toContain('DTSTART:20260410T093000')
    })

    it('is carried by a transport with legs on its first leg, and by no event of its own', () => {
      const list = uids(
        linked({
          transports: [transport()],
          legs: [leg({ departureTime: null })],
          reservations: [reservation({ transportId: 'transport1' })],
        }),
      )
      const event = only(
        linked({
          transports: [transport()],
          legs: [leg({ departureTime: null })],
          reservations: [reservation({ transportId: 'transport1' })],
        }),
        'leg-',
      )

      expect(list).toEqual(['leg-leg1@planned.travel'])
      // The leg has a zone but adopts a wall-clock time, so it is floating at both ends.
      expect(event).toContain('DTSTART:20260411T200000')
    })

    it('gives a transport without a time the reservation’s time, floating', () => {
      const event = only(
        linked({
          transports: [transport({ departureTime: null, arrivalTime: null })],
          reservations: [reservation({ transportId: 'transport1' })],
        }),
        'transport-',
      )

      expect(event).toContain('DTSTART:20260411T200000')
    })

    it('is one event with its stay, and shows the reserved times when the stay has none', () => {
      const src = linked({
        stays: [stay({ reservationId: 'res1' })],
        reservations: [
          reservation({
            startDate: '2026-04-10',
            startTime: '14:00',
            endDate: '2026-04-12',
            endTime: '12:00',
          }),
        ],
      })

      expect(uids(src)).toEqual(['stay-stay1@planned.travel'])
      expect(valueOf(only(src, 'stay-'), 'DESCRIPTION')).toBe('14:00 → 12:00')
    })

    it('does not give a time to a record from a cancelled reservation', () => {
      const list = uids(
        linked({
          places: [place()],
          stops: [stop({ startTime: null })],
          reservations: [
            reservation({ assignmentId: 'stop1', status: 'cancelled' }),
          ],
        }),
      )

      expect(list.some((uid) => uid.startsWith('stop-'))).toBe(false)
      expect(list.some((uid) => uid.startsWith('reservation-'))).toBe(false)
    })
  })

  describe('what never leaves the trip', () => {
    it('carries none of the fields the projection leaves out, even if a row somehow has them', () => {
      const secrets = {
        confirmationNumber: 'CONF-998877',
        bookingCode: 'BOOK-554433',
        seat: '17C',
        priceMinor: 987654,
        url: 'https://provider.example/booking/secret',
        guests: 'GUESTS-4471',
        userId: 'user-private-id',
        email: 'traveller@example.test',
        organizationName: 'Acme Travel Workspace',
      }
      // Rows built wider than the type, as a read that forgot to narrow would hand them over.
      const wide = <T extends object>(row: T): T => ({ ...row, ...secrets })

      const text = build(
        source({
          trips: [wide(trip({ summary: 'Two nights' }))],
          days: DAYS.map((row) => wide(row)),
          places: [wide(place())],
          stops: [wide(stop())],
          dayNotes: [wide(dayNote())],
          stays: [wide(stay())],
          transports: [wide(transport())],
          legs: [wide(leg())],
          reservations: [wide(reservation())],
        }),
      )

      for (const value of Object.values(secrets)) {
        expect(text).not.toContain(String(value))
      }
      expect(text).not.toContain('VTIMEZONE')
    })
  })

  describe('identity and stamps', () => {
    const full = (parts: Partial<FeedSource> = {}) =>
      source({
        days: DAYS,
        places: [place(), place({ id: 'place2', name: 'Time Out Market' })],
        stops: [
          stop(),
          stop({ id: 'stop2', placeId: 'place2', startTime: '13:00' }),
        ],
        dayNotes: [dayNote()],
        stays: [stay()],
        transports: [transport()],
        legs: [leg()],
        reservations: [reservation()],
        ...parts,
      })

    it('derives every UID from the row: kind, row id, planned.travel', () => {
      expect([...uids(full())].sort()).toEqual(
        [
          'day-day1@planned.travel',
          'leg-leg1@planned.travel',
          'reservation-res1@planned.travel',
          'stay-stay1@planned.travel',
          'stop-stop1@planned.travel',
          'stop-stop2@planned.travel',
          'trip-trip1@planned.travel',
        ].sort(),
      )
    })

    it('never calls a reservation a booking', () => {
      expect(build(full())).not.toContain('UID:booking-')
    })

    it('is byte-identical on every build', () => {
      expect(build(full())).toBe(build(full()))
    })

    it('does not depend on the order the rows were read in', () => {
      const forward = full()
      const backward = full({
        places: [...forward.places].reverse(),
        stops: [...forward.stops].reverse(),
        days: [...forward.days].reverse(),
      })

      expect(build(backward)).toBe(build(forward))
    })

    it('stamps an event with the latest edit of any row it is built from', () => {
      const later = new Date('2026-05-02T10:15:00.000Z')
      const event = only(
        full({
          places: [
            place({ updatedAt: later }),
            place({ id: 'place2', name: 'x' }),
          ],
        }),
        'stop-stop1@',
      )

      expect(event).toContain('DTSTAMP:20260502T101500Z')
      expect(event).toContain('LAST-MODIFIED:20260502T101500Z')
    })

    it('moves a stop’s LAST-MODIFIED when its place is renamed, and nothing else’s', () => {
      const before = full()
      const renamed = full({
        places: [
          place({
            name: 'Miradouro (renamed)',
            updatedAt: new Date('2026-05-02T10:15:00.000Z'),
          }),
          place({ id: 'place2', name: 'Time Out Market' }),
        ],
      })

      expect(valueOf(only(renamed, 'stop-stop1@'), 'LAST-MODIFIED')).toBe(
        '20260502T101500Z',
      )
      expect(only(renamed, 'stop-stop2@')).toEqual(only(before, 'stop-stop2@'))
      expect(only(renamed, 'trip-')).toEqual(only(before, 'trip-'))
      expect(only(renamed, 'leg-')).toEqual(only(before, 'leg-'))
    })

    it('moves a day’s LAST-MODIFIED when one of its notes is edited', () => {
      const later = new Date('2026-05-03T09:00:00.000Z')
      const event = only(
        full({ dayNotes: [dayNote({ body: 'Changed', updatedAt: later })] }),
        'day-day1@',
      )

      expect(event).toContain('LAST-MODIFIED:20260503T090000Z')
    })

    it('moves a leg’s LAST-MODIFIED when its transport is edited', () => {
      const later = new Date('2026-05-03T09:00:00.000Z')
      const event = only(
        full({ transports: [transport({ updatedAt: later })] }),
        'leg-leg1@',
      )

      expect(event).toContain('LAST-MODIFIED:20260503T090000Z')
    })

    it('moves a stop’s LAST-MODIFIED when its linked reservation is edited', () => {
      const later = new Date('2026-05-03T09:00:00.000Z')
      const event = only(
        full({
          reservations: [
            reservation({ assignmentId: 'stop1', updatedAt: later }),
          ],
        }),
        'stop-stop1@',
      )

      expect(event).toContain('LAST-MODIFIED:20260503T090000Z')
    })
  })
})
