import { describe, expect, it } from 'vitest'

import { TRANSPORT_MODES } from '#/components/modules/transports/vocabulary'
import {
  GOOGLE_DIRECTIONS_MAX_STOPS,
  GOOGLE_DIRECTIONS_MAX_WAYPOINTS,
  JOURNEY_SPLIT_MODES,
  MAP_SERVICE_NAME,
  dayHandoff,
  dayHandoffs,
  pointLink,
} from '../handoff'

import type { DayHandoffItem } from '../handoff'

/**
 * The map hand-off: the link a stop or a day offers into the map application the reader
 * navigates with.
 *
 * The builder is pure, so everything the controls rely on is claimed here: the exact
 * URL shape of each documented format, that the coordinates reuse `formatCoordinate`,
 * that an unplaced stop never reaches a URL or shifts the others, and that a day over
 * the waypoint limit says how much it carries instead of dropping stops silently.
 */

const FUSHIMI = { lat: 34.9671, lng: 135.7727 }
const KINKAKUJI = { lat: 35.0394, lng: 135.7292 }
const ARASHIYAMA = { lat: 35.0094, lng: 135.6668 }
const UNPLACED = { lat: null, lng: null }

/** A day of `count` placed stops, each at its own whole-degree latitude. */
function stopsOf(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    lat: index + 1,
    lng: 10,
  }))
}

describe('pointLink — one position, in either named service', () => {
  it('builds the documented Google Maps search URL', () => {
    expect(pointLink('google', FUSHIMI)).toBe(
      'https://www.google.com/maps/search/?api=1&query=34.9671%2C135.7727',
    )
  })

  it('builds an OpenStreetMap link that marks the point and centres on it', () => {
    expect(pointLink('openstreetmap', FUSHIMI)).toBe(
      'https://www.openstreetmap.org/?mlat=34.9671&mlon=135.7727#map=17/34.9671/135.7727',
    )
  })

  it('writes negative halves with a minus sign and a dot', () => {
    const link = pointLink('google', { lat: -33.8568, lng: -151.2153 })
    expect(link).toContain('query=-33.8568%2C-151.2153')
  })

  it('never writes exponent notation or a trailing zero', () => {
    const link = pointLink('google', { lat: 0.0000001, lng: 12.5 })
    expect(link).toContain('query=0%2C12.5')
    expect(link).not.toMatch(/e[+-]?\d/i)
  })

  it('names its services as data, not as translated copy', () => {
    expect(MAP_SERVICE_NAME).toEqual({
      google: 'Google Maps',
      openstreetmap: 'OpenStreetMap',
    })
  })
})

describe('dayHandoff — the day, in visiting order', () => {
  it('offers nothing for a day with no placed stop', () => {
    expect(dayHandoff([])).toBeNull()
    expect(dayHandoff([UNPLACED, UNPLACED])).toBeNull()
  })

  it('offers a point link, not directions, for exactly one placed stop', () => {
    expect(dayHandoff([UNPLACED, FUSHIMI, UNPLACED])).toEqual({
      kind: 'point',
      href: pointLink('google', FUSHIMI),
      carried: 1,
      total: 1,
    })
  })

  it('offers directions from the first stop to the last for two', () => {
    const handoff = dayHandoff([FUSHIMI, KINKAKUJI])
    expect(handoff).toEqual({
      kind: 'directions',
      href: 'https://www.google.com/maps/dir/?api=1&origin=34.9671%2C135.7727&destination=35.0394%2C135.7292',
      carried: 2,
      total: 2,
    })
  })

  it('carries the middle stops as pipe-separated waypoints, in order', () => {
    const handoff = dayHandoff([FUSHIMI, KINKAKUJI, ARASHIYAMA])
    expect(handoff?.href).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=34.9671%2C135.7727&destination=35.0094%2C135.6668&waypoints=35.0394%2C135.7292',
    )

    const four = dayHandoff([FUSHIMI, KINKAKUJI, ARASHIYAMA, FUSHIMI])
    const waypoints = new URL(four?.href ?? '').searchParams.get('waypoints')
    expect(waypoints).toBe('35.0394,135.7292|35.0094,135.6668')
    expect(four?.href).toContain('waypoints=35.0394%2C135.7292%7C35.0094')
  })

  it('counts a stop at 0,0 as placed', () => {
    expect(dayHandoff([{ lat: 0, lng: 0 }])?.kind).toBe('point')
  })

  it('skips a stop without coordinates without shifting the others', () => {
    const withGap = dayHandoff([
      FUSHIMI,
      UNPLACED,
      KINKAKUJI,
      { lat: 35.1, lng: null },
      ARASHIYAMA,
    ])
    expect(withGap).toEqual(dayHandoff([FUSHIMI, KINKAKUJI, ARASHIYAMA]))
    expect(withGap?.total).toBe(3)
  })

  it('keeps visiting order across the antimeridian', () => {
    const handoff = dayHandoff([
      { lat: -17.7, lng: 179.9 },
      { lat: -16.8, lng: -179.9 },
    ])
    const params = new URL(handoff?.href ?? '').searchParams
    expect(params.get('origin')).toBe('-17.7,179.9')
    expect(params.get('destination')).toBe('-16.8,-179.9')
  })
})

describe('dayHandoff — the waypoint limit', () => {
  it('pins the limit that holds on a phone, where the pavement is', () => {
    // developers.google.com/maps/documentation/urls/get-started, "waypoints": up to three
    // on mobile browsers, nine elsewhere. One link serves both, so the lower figure rules.
    expect(GOOGLE_DIRECTIONS_MAX_WAYPOINTS).toBe(3)
    expect(GOOGLE_DIRECTIONS_MAX_STOPS).toBe(5)
  })

  it('carries exactly the maximum without saying it left anything out', () => {
    const handoff = dayHandoff(stopsOf(GOOGLE_DIRECTIONS_MAX_STOPS))
    expect(handoff).toMatchObject({
      kind: 'directions',
      carried: GOOGLE_DIRECTIONS_MAX_STOPS,
      total: GOOGLE_DIRECTIONS_MAX_STOPS,
    })
    const params = new URL(handoff?.href ?? '').searchParams
    expect(params.get('waypoints')?.split('|')).toHaveLength(
      GOOGLE_DIRECTIONS_MAX_WAYPOINTS,
    )
  })

  it('carries the first stops in order and counts the rest when one over', () => {
    const handoff = dayHandoff(stopsOf(GOOGLE_DIRECTIONS_MAX_STOPS + 1))
    expect(handoff).toMatchObject({
      kind: 'directions',
      carried: GOOGLE_DIRECTIONS_MAX_STOPS,
      total: GOOGLE_DIRECTIONS_MAX_STOPS + 1,
    })
    const params = new URL(handoff?.href ?? '').searchParams
    expect(params.get('origin')).toBe('1,10')
    expect(params.get('waypoints')).toBe('2,10|3,10|4,10')
    expect(params.get('destination')).toBe('5,10')
  })

  it('counts placed stops only, so unplaced ones never use up the allowance', () => {
    const handoff = dayHandoff([
      UNPLACED,
      ...stopsOf(GOOGLE_DIRECTIONS_MAX_STOPS),
      UNPLACED,
    ])
    expect(handoff).toMatchObject({
      carried: GOOGLE_DIRECTIONS_MAX_STOPS,
      total: GOOGLE_DIRECTIONS_MAX_STOPS,
    })
  })
})

/** A placed stop at its own whole-degree latitude, as the day's displayed sequence holds it. */
function stop(lat: number | null): DayHandoffItem {
  return {
    kind: 'stop',
    row: lat === null ? UNPLACED : { lat, lng: 10 },
  }
}

function journey(mode: string): DayHandoffItem {
  return { kind: 'transport', transport: { mode } }
}

const NOTE: DayHandoffItem = { kind: 'note' }

describe('dayHandoffs — a day split by a journey', () => {
  it('names the modes that split a day, all of them in the Transport vocabulary', () => {
    expect([...JOURNEY_SPLIT_MODES].sort()).toEqual([
      'ferry',
      'flight',
      'train',
    ])
    const vocabulary: ReadonlyArray<string> = TRANSPORT_MODES
    for (const mode of JOURNEY_SPLIT_MODES) {
      expect(vocabulary).toContain(mode)
    }
  })

  it('gives exactly the one link dayHandoff gives when nothing splits the day', () => {
    const stops = [1, 2, 3]
    expect(dayHandoffs([...stops.map(stop), NOTE])).toEqual([
      dayHandoff(stops.map((lat) => ({ lat, lng: 10 }))),
    ])
  })

  it('gives nothing for a day with no placed stop', () => {
    expect(dayHandoffs([])).toEqual([])
    expect(dayHandoffs([stop(null), journey('flight'), stop(null)])).toEqual([])
  })

  it('gives one link per side of a flight, each by the usual rules', () => {
    const links = dayHandoffs([
      stop(1),
      stop(2),
      journey('flight'),
      stop(3),
      stop(4),
    ])

    expect(links).toHaveLength(2)
    const [before, after] = links
    expect(before).toEqual(
      dayHandoff([
        { lat: 1, lng: 10 },
        { lat: 2, lng: 10 },
      ]),
    )
    expect(after).toEqual(
      dayHandoff([
        { lat: 3, lng: 10 },
        { lat: 4, lng: 10 },
      ]),
    )
    // Never a route from the last stop before the journey to the first after it.
    expect(new URL(before?.href ?? '').searchParams.get('destination')).toBe(
      '2,10',
    )
    expect(new URL(after?.href ?? '').searchParams.get('origin')).toBe('3,10')
  })

  it.each(['ferry', 'train'])('splits at a %s too', (mode) => {
    const links = dayHandoffs([
      stop(1),
      stop(2),
      journey(mode),
      stop(3),
      stop(4),
    ])
    expect(links.map((link) => link.carried)).toEqual([2, 2])
  })

  it('gives a point link for a side with one placed stop', () => {
    const links = dayHandoffs([stop(1), journey('train'), stop(2), stop(3)])

    expect(links.map((link) => link.kind)).toEqual(['point', 'directions'])
    expect(links[0]?.href).toBe(
      'https://www.google.com/maps/search/?api=1&query=1%2C10',
    )
  })

  it('gives three links for two journeys', () => {
    const links = dayHandoffs([
      stop(1),
      stop(2),
      journey('flight'),
      stop(3),
      journey('ferry'),
      stop(4),
      stop(5),
    ])

    expect(links.map((link) => link.kind)).toEqual([
      'directions',
      'point',
      'directions',
    ])
  })

  it('cuts nothing for a journey first or last in the day', () => {
    const stops = [stop(1), stop(2)]
    const whole = dayHandoffs(stops)

    expect(whole).toHaveLength(1)
    expect(dayHandoffs([journey('flight'), ...stops])).toEqual(whole)
    expect(dayHandoffs([...stops, journey('flight')])).toEqual(whole)
    expect(
      dayHandoffs([journey('flight'), ...stops, journey('train')]),
    ).toEqual(whole)
  })

  it('drops the empty side between two adjacent journeys', () => {
    const links = dayHandoffs([
      stop(1),
      stop(2),
      journey('flight'),
      journey('train'),
      stop(3),
      stop(4),
    ])

    expect(links).toHaveLength(2)
  })

  it.each([
    'bus',
    'taxi',
    'car',
    'transit',
    'metro',
    'tram',
    'bike',
    'walk',
    'other',
    'hovercraft',
  ])('leaves the day whole across a %s', (mode) => {
    const links = dayHandoffs([stop(1), journey(mode), stop(2)])
    expect(links).toHaveLength(1)
    expect(links[0]).toMatchObject({ kind: 'directions', carried: 2 })
  })

  it('splits at a short ferry between two of the day’s own stops: the mode decides', () => {
    expect(dayHandoffs([stop(1), journey('ferry'), stop(2)])).toHaveLength(2)
  })

  it('cuts at the position in the sequence it is given, never by a coordinate', () => {
    // The stop before the journey is the northernmost: only the order says which side it is on.
    const links = dayHandoffs([stop(9), journey('flight'), stop(1), stop(2)])

    expect(links.map((link) => link.kind)).toEqual(['point', 'directions'])
    expect(links[0]?.href).toBe(
      'https://www.google.com/maps/search/?api=1&query=9%2C10',
    )
  })

  it('still splits at a cancelled journey: the mode marks the distance, status is not read', () => {
    const cancelled = {
      kind: 'transport',
      transport: { mode: 'flight', status: 'cancelled' },
    } as const

    expect(dayHandoffs([stop(1), cancelled, stop(2)])).toHaveLength(2)
  })

  it('skips an unplaced stop on either side without shifting the others', () => {
    const links = dayHandoffs([
      stop(null),
      stop(1),
      stop(2),
      stop(null),
      journey('flight'),
      stop(null),
      stop(3),
      stop(4),
    ])

    expect(links).toHaveLength(2)
    expect(links[0]).toMatchObject({ kind: 'directions', total: 2 })
    expect(links[1]).toMatchObject({ kind: 'directions', total: 2 })
  })

  it('counts the cap per side', () => {
    const over = GOOGLE_DIRECTIONS_MAX_STOPS + 2
    const side = (from: number) =>
      Array.from({ length: over }, (_, index) => stop(from + index))
    const [before, after] = dayHandoffs([
      ...side(1),
      journey('flight'),
      ...side(100),
    ])

    for (const link of [before, after]) {
      expect(link).toMatchObject({
        carried: GOOGLE_DIRECTIONS_MAX_STOPS,
        total: over,
      })
    }
  })

  it('carries no travel mode on any link', () => {
    for (const link of dayHandoffs([
      stop(1),
      stop(2),
      journey('flight'),
      stop(3),
      stop(4),
    ])) {
      expect(new URL(link.href).searchParams.has('travelmode')).toBe(false)
    }
  })
})
