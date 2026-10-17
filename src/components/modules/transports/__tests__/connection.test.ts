/**
 * The arithmetic between a provider's answer and a journey record.
 *
 * `connection-search.tsx` renders a list, but four of the things it does are not rendering at all:
 * it orders the answer two ways, it decides where the journey actually starts, it turns N legs
 * into the N+1 stations and N legs the chain writer takes, and it decides what mode the record is
 * saved under. Each is a pure function, each is exported, and each is wrong in a way no screenshot
 * would catch — a chain whose stations and legs disagree is refused by the server with a message
 * about arithmetic, which is not a thing a traveller can act on.
 *
 * **This file is outside the issue's owned paths**, and is here for the reason `03-S2b` and
 * `03-S4` each gave once: a red-green cycle needs somewhere to be red, and the only test file this
 * stage owns is `src/server/transit/__tests__/search.test.ts`, whose subject is the proxy and which
 * runs in the Node project where a `.tsx` module has no business being imported. It owns nothing
 * another stage claims.
 */
import { describe, expect, it, vi } from 'vitest'

import {
  chainFor,
  connectionMode,
  journeyLegs,
  placeOf,
  rankConnections,
  refusalBody,
  refusalTitle,
  startingDate,
} from '../connection-search'

import { modulesTranslate as t } from '#/lib/i18n/__tests__/modules-translate'

import type { ConnectionRefusal } from '../connection-search'
import type { StationMatch, TransitConnection } from '#/server/fns/transports'
import type { TransportDayData } from '../types'

/**
 * The server-function module is replaced wholesale, and it has to be.
 *
 * `connection-search.tsx` imports the three server functions it calls, and that module reaches
 * `cloudflare:workers` — a specifier the `ui` Vitest project cannot resolve at all, which is the
 * same wall `fns/__tests__/reservations.test.ts` describes from the other side. None of the three
 * is reached by anything under test here: what is exercised is the arithmetic between a provider's
 * answer and a journey record, which touches no network and no binding.
 *
 * Written after the imports and applied before them: `vi.mock` is hoisted by the runner, which is
 * why this reads out of order and runs in order.
 */
vi.mock('#/server/fns/transports', () => ({
  searchStationsFn: () => Promise.resolve([]),
  searchConnectionsFn: () => Promise.resolve(null),
  saveSearchedConnectionFn: () => Promise.resolve(null),
}))

function stop(name: string, at: string | null) {
  return { name, lat: null, lng: null, at }
}

function leg(
  mode: TransitConnection['legs'][number]['mode'],
  from: string,
  to: string,
  departs: string | null,
  arrives: string | null,
  name: string | null = null,
) {
  return {
    mode,
    name,
    headsign: null,
    origin: stop(from, departs),
    destination: stop(to, arrives),
    intermediateStops: [],
  }
}

function connection(
  overrides: Partial<TransitConnection> = {},
): TransitConnection {
  return {
    id: 'R1',
    departureAt: '2026-10-09T08:12:00',
    arrivalAt: '2026-10-09T11:03:00',
    durationMinutes: 171,
    changes: 1,
    modes: ['train'],
    fare: null,
    legs: [
      leg(
        'train',
        'Lisboa Santa Apolónia',
        'Coimbra-B',
        '2026-10-09T08:12:00',
        '2026-10-09T09:41:00',
        'IC 728',
      ),
      leg(
        'train',
        'Coimbra-B',
        'Porto Campanhã',
        '2026-10-09T09:55:00',
        '2026-10-09T11:03:00',
        'IC 520',
      ),
    ],
    ...overrides,
  }
}

const LISBON: StationMatch = {
  code: 'LIS',
  name: 'Lisboa',
  city: 'Lisboa',
  countryCode: 'PT',
  timezone: 'Europe/Lisbon',
  lat: 38.77,
  lng: -9.13,
}

const PORTO: StationMatch = {
  ...LISBON,
  code: 'OPO',
  name: 'Porto',
  city: 'Porto',
  lat: 41.24,
  lng: -8.68,
}

describe('rankConnections', () => {
  const early = connection({
    id: 'early',
    arrivalAt: '2026-10-09T10:00:00',
    durationMinutes: 200,
    changes: 3,
  })
  const direct = connection({
    id: 'direct',
    arrivalAt: '2026-10-09T12:00:00',
    durationMinutes: 150,
    changes: 0,
  })

  it('puts the one that lands first at the top of "earliest arrival"', () => {
    expect(
      rankConnections([direct, early], 'earliest').map((c) => c.id),
    ).toEqual(['early', 'direct'])
  })

  it('puts the one with fewest changes at the top of "fewest changes"', () => {
    expect(
      rankConnections([early, direct], 'fewest-changes').map((c) => c.id),
    ).toEqual(['direct', 'early'])
  })

  /** A tie must not reshuffle between renders, so the shorter journey breaks it. */
  it('breaks a tie on the shorter journey either way', () => {
    const slow = connection({ id: 'slow', durationMinutes: 300, changes: 1 })
    const quick = connection({ id: 'quick', durationMinutes: 100, changes: 1 })
    for (const ranking of ['earliest', 'fewest-changes'] as const) {
      expect(rankConnections([slow, quick], ranking).map((c) => c.id)).toEqual([
        'quick',
        'slow',
      ])
    }
  })

  it('does not reorder the answer it was handed', () => {
    const answer = [direct, early]
    rankConnections(answer, 'earliest')
    expect(answer.map((c) => c.id)).toEqual(['direct', 'early'])
  })
})

describe('journeyLegs', () => {
  it('drops the walk to the platform and the walk off it', () => {
    const walked = connection({
      legs: [
        leg('walk', 'Rua Augusta', 'Lisboa Santa Apolónia', null, null),
        ...connection().legs,
        leg('walk', 'Porto Campanhã', 'Hotel', null, null),
      ],
    })
    expect(journeyLegs(walked).map((one) => one.name)).toEqual([
      'IC 728',
      'IC 520',
    ])
  })

  /** A walk between two rides is a change, and dropping it would break the chain. */
  it('keeps a walk between two rides', () => {
    const [first, second] = connection().legs
    const changed = connection({
      legs: [first, leg('walk', 'Coimbra-B', 'Coimbra-B', null, null), second],
    })
    expect(journeyLegs(changed)).toHaveLength(3)
  })

  it('never empties a connection that is only a walk', () => {
    const strolled = connection({
      legs: [leg('walk', 'Here', 'There', null, null)],
    })
    expect(journeyLegs(strolled)).toHaveLength(1)
  })
})

describe('connectionMode', () => {
  it('is the mode when every ride agrees', () => {
    expect(connectionMode(connection({ modes: ['ferry'] }))).toBe('ferry')
  })

  it('is transit when they do not, and when there is nothing to agree about', () => {
    expect(connectionMode(connection({ modes: ['train', 'bus'] }))).toBe(
      'transit',
    )
    expect(connectionMode(connection({ modes: [] }))).toBe('transit')
  })
})

describe('placeOf', () => {
  it('answers a query endpoint for a stop the catalogue placed', () => {
    expect(placeOf(LISBON)).toEqual({ name: 'Lisboa', lat: 38.77, lng: -9.13 })
  })

  /** Never a `0` stand-in: that is a search of the Gulf of Guinea reported as Lisbon. */
  it('answers nothing for a stop with no coordinates', () => {
    expect(placeOf(null)).toBeNull()
    expect(placeOf({ ...LISBON, lat: null })).toBeNull()
    expect(placeOf({ ...LISBON, lng: null })).toBeNull()
  })
})

describe('chainFor', () => {
  it('turns N legs into N+1 stations and N legs', () => {
    const chain = chainFor(connection(), LISBON, PORTO, t)
    expect(chain.stations.map((station) => station.name)).toEqual([
      'Lisboa Santa Apolónia',
      'Coimbra-B',
      'Porto Campanhã',
    ])
    expect(chain.legs).toHaveLength(2)
    expect(chain.legs.length).toBe(chain.stations.length - 1)
  })

  /** The station two legs meet at is written once, so the two rows cannot disagree. */
  it('writes the shared station once, from the earlier leg’s arrival', () => {
    const chain = chainFor(connection(), LISBON, PORTO, t)
    expect(chain.stations[1].name).toBe('Coimbra-B')
    expect(chain.legs[0].arrivalTime).toBe('09:41')
    expect(chain.legs[1].departureTime).toBe('09:55')
  })

  it('splits each provider clock into the date and the wall clock the columns hold', () => {
    const chain = chainFor(connection(), LISBON, PORTO, t)
    expect(chain.legs[0]).toMatchObject({
      serviceNumber: 'IC 728',
      departureDate: '2026-10-09',
      departureTime: '08:12',
      arrivalDate: '2026-10-09',
      arrivalTime: '09:41',
    })
  })

  /**
   * A zone on the two ends and nowhere else. The provider states an offset, which is not a zone;
   * the catalogue rows behind the two pickers state an IANA name, which is.
   */
  it('takes the zone from the picked stops, and claims none in between', () => {
    const chain = chainFor(connection(), LISBON, PORTO, t)
    expect(chain.stations.map((station) => station.timezone)).toEqual([
      'Europe/Lisbon',
      '',
      'Europe/Lisbon',
    ])
    expect(
      chainFor(connection(), null, null, t).stations.map((s) => s.timezone),
    ).toEqual(['', '', ''])
  })

  /** A timetable knows clocks, not which day of the trip they are; inventing that is a wrong page. */
  it('names no itinerary day', () => {
    for (const one of chainFor(connection(), LISBON, PORTO, t).legs) {
      expect(one.departureDayId).toBe('')
      expect(one.arrivalDayId).toBe('')
    }
  })

  it('leaves a stop the provider gave no time for empty rather than guessing one', () => {
    const untimed = connection({
      legs: [leg('bus', 'Village', 'Town', null, null, '12A')],
    })
    expect(chainFor(untimed, null, null, t).legs[0]).toMatchObject({
      departureDate: '',
      departureTime: '',
      arrivalDate: '',
      arrivalTime: '',
    })
  })

  it('gives an unnamed stop a name rather than an empty required field', () => {
    const unnamed = connection({
      legs: [leg('bus', '', 'Town', null, null)],
    })
    expect(chainFor(unnamed, null, null, t).stations[0].name).toBe('Stop')
  })
})

/**
 * The date the dialog opens on.
 *
 * A re-search keeps the days the journey was anchored to (`carryAnchors`), so a field that starts
 * on the trip's first day lets a save without touching it leave the legs showing one date and
 * sitting on another day. These pin the order: the anchored day's date, then the journey's own
 * recorded date, then the first dated day - and that the answer is never outside what the date
 * input accepts.
 */
describe('startingDate', () => {
  const day = (
    id: string,
    dayNumber: number,
    date: string | null,
  ): TransportDayData => ({ id, dayNumber, date, title: null })
  const days = [
    day('d1', 1, '2026-10-09'),
    day('d2', 2, '2026-10-10'),
    day('d3', 3, null),
    day('d4', 4, '2026-10-12'),
  ]
  const journey = (
    overrides: Partial<{
      departureDayId: string | null
      departureDate: string | null
      legs: ReadonlyArray<{ departureDayId: string | null }>
    }> = {},
  ) => ({
    departureDayId: null,
    departureDate: null,
    legs: [],
    ...overrides,
  })

  it('starts a new journey on the first dated day', () => {
    expect(startingDate(days, undefined)).toBe('2026-10-09')
    expect(startingDate([day('x', 1, null), ...days], undefined)).toBe(
      '2026-10-09',
    )
  })

  it('starts an anchored, dated journey on its anchor day', () => {
    const anchored = journey({
      departureDate: '2026-10-09',
      legs: [{ departureDayId: 'd4' }, { departureDayId: 'd1' }],
    })
    expect(startingDate(days, anchored)).toBe('2026-10-12')
  })

  it('reads the anchor from the first leg, never from the record, when there are legs', () => {
    const anchored = journey({
      departureDayId: 'd4',
      legs: [{ departureDayId: 'd2' }],
    })
    expect(startingDate(days, anchored)).toBe('2026-10-10')
  })

  it('ignores the record anchor day when the first leg is unanchored', () => {
    const anchored = journey({
      departureDayId: 'd4',
      departureDate: '2026-10-11',
      legs: [{ departureDayId: null }],
    })
    expect(startingDate(days, anchored)).toBe('2026-10-11')
  })

  it('reads the anchor from the record when the journey has no legs', () => {
    expect(startingDate(days, journey({ departureDayId: 'd2' }))).toBe(
      '2026-10-10',
    )
  })

  it('falls back to the journey own date when the anchor day has no date', () => {
    const anchored = journey({
      departureDate: '2026-10-11',
      legs: [{ departureDayId: 'd3' }],
    })
    expect(startingDate(days, anchored)).toBe('2026-10-11')
  })

  it('falls back to the journey own date when the trip no longer has the anchor day', () => {
    const anchored = journey({
      departureDate: '2026-10-10',
      legs: [{ departureDayId: 'gone' }],
    })
    expect(startingDate(days, anchored)).toBe('2026-10-10')
  })

  it('falls back to the journey own date when it has no anchor', () => {
    expect(startingDate(days, journey({ departureDate: '2026-10-12' }))).toBe(
      '2026-10-12',
    )
  })

  it('starts on the first dated day when the journey own date is outside the trip', () => {
    expect(startingDate(days, journey({ departureDate: '2026-10-08' }))).toBe(
      '2026-10-09',
    )
    expect(startingDate(days, journey({ departureDate: '2026-10-13' }))).toBe(
      '2026-10-09',
    )
  })

  it('starts on the first dated day when the journey has neither anchor nor date', () => {
    expect(startingDate(days, journey())).toBe('2026-10-09')
  })

  it('is empty only when the trip has no dated day at all', () => {
    expect(startingDate([day('d1', 1, null)], journey())).toBe('')
    expect(
      startingDate(
        [day('d1', 1, null)],
        journey({ departureDate: '2026-10-09' }),
      ),
    ).toBe('')
  })
})

/**
 * The five refusals, and the one thing every one of them has to be: a sentence out of the
 * catalogue.
 *
 * This is the only surface in the dialog where a *server* decides what the reader is told, and the
 * shape that invites the mistake is a `message` on the wire: rendering it puts one language's
 * sentence in front of twenty-three, and the parity gate never sees it because it is not a key.
 * So the wire carries facts and this maps them, and these tests are the guard the parity gate
 * cannot be — every state resolves, every state says something of its own, and the allowance says
 * how big it was.
 */
describe('refusalTitle and refusalBody', () => {
  const refusal = (
    over: Partial<ConnectionRefusal> = {},
  ): ConnectionRefusal => ({
    ok: false,
    reason: 'unreachable',
    ceiling: 50,
    ...over,
  })

  const states: ReadonlyArray<ConnectionRefusal> = [
    refusal({ reason: 'ceiling', ceiling: 0 }),
    refusal({ reason: 'ceiling', ceiling: 50 }),
    refusal({ reason: 'unconfigured' }),
    refusal({ reason: 'unreachable' }),
    refusal({ reason: 'refused' }),
    refusal({ reason: 'malformed' }),
  ]

  it('resolves every reason to a real sentence rather than to its key', () => {
    for (const state of states) {
      const title = t(refusalTitle(state))
      const body = refusalBody(state, t, 'en')
      expect(title).not.toContain('modules.transports')
      expect(body).not.toContain('modules.transports')
      expect(body.length).toBeGreaterThan(20)
    }
  })

  /** Buying an allowance and waiting for one are different answers, so they are different words. */
  it('separates an allowance that is absent from one that is spent', () => {
    const [absent, spent] = states
    expect(refusalTitle(absent)).not.toBe(refusalTitle(spent))
    expect(refusalBody(absent, t, 'en')).not.toBe(refusalBody(spent, t, 'en'))
    expect(refusalBody(spent, t, 'en')).toContain('50')
    expect(refusalBody(absent, t, 'en')).not.toContain('0')
  })

  /** Unreachable, refused and nonsense are one answer to a reader: try again, or write it down. */
  it('gives the three provider failures the same words', () => {
    const [, , , unreachable, refused, malformed] = states
    expect(refusalBody(refused, t, 'en')).toBe(
      refusalBody(unreachable, t, 'en'),
    )
    expect(refusalBody(malformed, t, 'en')).toBe(
      refusalBody(unreachable, t, 'en'),
    )
    expect(refusalBody(unreachable, t, 'en')).not.toBe(
      refusalBody(states[2], t, 'en'),
    )
  })
})
