/**
 * The chain invariant, on its own: N stations, N−1 legs, at every edit.
 *
 * The editor is a list of stations with a list of legs hanging between them, and
 * the one thing that can go wrong is those two lists disagreeing. A chain of
 * four stations with two legs is not a shorter journey — it is a journey that
 * cannot be rendered, cannot be saved and cannot be reasoned about. So the
 * arithmetic is asserted after an insert, after a removal and after both, and
 * the two edits that change it are the only two functions that may.
 *
 * The compatibility claim is here too, and it is the one this whole stage rests
 * on: a transport recorded before chains existed has no rows in `transport_legs`,
 * and the chain built from it must reproduce its flat endpoints *exactly*. That
 * is what lets the migration backfill nothing.
 */
import { describe, expect, it } from 'vitest'

import { modulesTranslate } from '#/lib/i18n/__tests__/modules-translate'

import {
  CHAIN_MAX_LEGS,
  applyStationMatch,
  blockingLegErrors,
  chainFromTransport,
  breakIntoLegs,
  chainPayload,
  emptyChain,
  emptyStation,
  emptyLegDraft,
  fillStationFromCode,
  flatChain,
  hasChainErrors,
  hasLegErrors,
  isLookupCode,
  removeStationAt,
  updateStationByKey,
  splitLegAt,
  stationLabel,
  validateChain,
} from '../leg-form'

import type { ChainDraft, LegErrors, StationLookup } from '../leg-form'
import type { TransportData } from '../types'

/** A transport as the loader hands it over, with only what the chain reads set. */
function transport(patch: Partial<TransportData> = {}): TransportData {
  return {
    id: 'tr-1',
    mode: 'train',
    status: 'confirmed',
    title: 'Osaka to Tokyo',
    carrier: 'JR Central',
    serviceNumber: 'Hikari 500',
    bookingCode: 'TXK9QP',
    seat: '7-11A',
    departureDayId: 'day-1',
    arrivalDayId: 'day-1',
    departureName: 'Shin-Osaka',
    departureCode: 'OSA',
    departureDate: '2026-04-10',
    departureTime: '09:00',
    arrivalName: 'Tokyo',
    arrivalCode: 'TYO',
    arrivalDate: '2026-04-10',
    arrivalTime: '12:40',
    distanceMetres: 515_000,
    priceMinor: 14_720,
    currency: 'JPY',
    notes: null,
    legs: [],
    ...patch,
  }
}

/** The two rows a saved Osaka–Nagoya–Tokyo journey is stored as. */
const RECORDED_LEGS: TransportData['legs'] = [
  {
    id: 'leg-a',
    position: 0,
    fromName: 'Shin-Osaka',
    fromCode: 'OSA',
    fromLat: null,
    fromLng: null,
    fromTimezone: 'Asia/Tokyo',
    toName: 'Nagoya',
    toCode: 'NGO',
    toLat: null,
    toLng: null,
    toTimezone: 'Asia/Tokyo',
    serviceNumber: 'Hikari 500',
    platform: '20',
    seat: '7-11A',
    departureDayId: 'day-1',
    departureDate: '2026-04-10',
    departureTime: '09:00',
    arrivalDayId: 'day-1',
    arrivalDate: '2026-04-10',
    arrivalTime: '09:50',
  },
  {
    id: 'leg-b',
    position: 1,
    fromName: 'Nagoya',
    fromCode: 'NGO',
    fromLat: null,
    fromLng: null,
    fromTimezone: 'Asia/Tokyo',
    toName: 'Tokyo',
    toCode: 'TYO',
    toLat: null,
    toLng: null,
    toTimezone: 'Asia/Tokyo',
    serviceNumber: 'Nozomi 24',
    platform: '16',
    seat: '3-2C',
    departureDayId: 'day-1',
    departureDate: '2026-04-10',
    departureTime: '10:10',
    arrivalDayId: 'day-1',
    arrivalDate: '2026-04-10',
    arrivalTime: '12:40',
  },
]

/** A three-station chain, which is the smallest one that can lose a middle. */
function threeStations(): ChainDraft {
  return splitLegAt(chainFromTransport(transport()), 0)
}

describe('a chain built from a record that has no legs', () => {
  /**
   * The compatibility claim, turned into an assertion. Nothing was backfilled,
   * so this is the only thing standing between an old journey and a blank editor.
   */
  it('reproduces the record’s own endpoints exactly', () => {
    const chain = chainFromTransport(transport())

    expect(chain.stations).toHaveLength(2)
    expect(chain.legs).toHaveLength(1)
    expect(chain.stations[0]).toMatchObject({
      name: 'Shin-Osaka',
      code: 'OSA',
    })
    expect(chain.stations[1]).toMatchObject({ name: 'Tokyo', code: 'TYO' })
    expect(chain.legs[0]).toMatchObject({
      serviceNumber: 'Hikari 500',
      seat: '7-11A',
      departureDayId: 'day-1',
      departureDate: '2026-04-10',
      departureTime: '09:00',
      arrivalDayId: 'day-1',
      arrivalDate: '2026-04-10',
      arrivalTime: '12:40',
    })
  })

  it('reads an unrecorded endpoint as an empty field, never as “null”', () => {
    const chain = chainFromTransport(
      transport({
        departureName: null,
        departureCode: null,
        arrivalName: null,
        arrivalCode: null,
        departureTime: null,
        arrivalDayId: null,
      }),
    )

    expect(chain.stations[0]).toMatchObject({ name: '', code: '' })
    expect(chain.legs[0]).toMatchObject({
      departureTime: '',
      arrivalDayId: '',
    })
  })

  it('prefers the rows once the record has them', () => {
    const chain = chainFromTransport(transport({ legs: RECORDED_LEGS }))

    expect(chain.broken).toBe(true)
    expect(chain.stations.map((station) => station.name)).toEqual([
      'Shin-Osaka',
      'Nagoya',
      'Tokyo',
    ])
    expect(chain.legs.map((leg) => leg.serviceNumber)).toEqual([
      'Hikari 500',
      'Nozomi 24',
    ])
  })
})

/**
 * Putting a journey back together, which is the door the traveller came in by,
 * walked the other way.
 *
 * The way *in* reads a saved journey as the chain it is, so it cannot also be
 * the way out — asked for the way out it hands back the very chain being put
 * away, and the button does nothing. So the way back is stated separately: the
 * record's own two endpoints, unbroken, which {@link chainPayload} then sends as
 * no rows at all and the writer takes as "remove the ones it had".
 */
describe('putting a chained journey back as one', () => {
  it('collapses a recorded chain to the record’s own endpoints', () => {
    const record = transport({ legs: RECORDED_LEGS })

    expect(chainFromTransport(record).broken).toBe(true)
    const flat = flatChain(record)

    expect(flat.broken).toBe(false)
    expect(flat.stations).toHaveLength(2)
    expect(flat.legs).toHaveLength(1)
    expect(flat.stations.map((station) => station.name)).toEqual([
      'Shin-Osaka',
      'Tokyo',
    ])
  })

  it('sends no rows once it is collapsed, which is what removes them', () => {
    expect(chainPayload(flatChain(transport({ legs: RECORDED_LEGS })))).toEqual(
      { stations: [], legs: [] },
    )
  })

  it('is what a record with no rows already reads as', () => {
    const record = transport()
    const opened = chainFromTransport(record)
    const collapsed = flatChain(record)

    expect(opened.broken).toBe(false)
    expect(opened.stations.map((station) => station.name)).toEqual(
      collapsed.stations.map((station) => station.name),
    )
    expect(opened.legs[0].departureTime).toBe(collapsed.legs[0].departureTime)
  })
})

/**
 * Which of the flat form's own errors may still stop a save.
 *
 * Once a journey is broken into legs the dialog writes the record's endpoints
 * and days from the outer stations and takes the flat pair of fieldsets off the
 * screen. An error against one of those fields is then invisible and unreachable
 * — a save button that will not fire with nothing on screen saying why — so the
 * chain's own errors are what stand in the way instead.
 */
describe('the draft errors a broken chain no longer answers for', () => {
  /** A time with no date beside it: the flat form's rule, on a hidden field. */
  const HIDDEN: LegErrors = {
    departureDate: 'modules.transports.error.departureNeedsDate',
  }

  it('keeps every error while the journey is one movement', () => {
    const chain = chainFromTransport(transport())

    expect(chain.broken).toBe(false)
    expect(blockingLegErrors(HIDDEN, chain)).toEqual(HIDDEN)
    expect(hasLegErrors(blockingLegErrors(HIDDEN, chain))).toBe(true)
  })

  it('drops it once the chain owns that field', () => {
    const chain = threeStations()

    expect(chain.broken).toBe(true)
    expect(hasLegErrors(blockingLegErrors(HIDDEN, chain))).toBe(false)
  })

  it('keeps the errors on fields the flat form still asks about', () => {
    const kept = blockingLegErrors(
      {
        ...HIDDEN,
        title: 'modules.transports.error.titleEmpty',
      },
      threeStations(),
    )

    expect(kept).toEqual({
      title: 'modules.transports.error.titleEmpty',
    })
  })

  it('leaves the errors it was handed alone', () => {
    const errors: LegErrors = { ...HIDDEN }
    blockingLegErrors(errors, threeStations())

    expect(errors).toEqual(HIDDEN)
  })

  it('drops exactly the fields the record is written from', () => {
    const everything = Object.fromEntries(
      Object.keys(emptyLegDraft('JPY')).map((key) => [key, 'wrong']),
    ) as LegErrors
    const kept = blockingLegErrors(everything, threeStations())

    expect(Object.keys(kept).sort()).toEqual(
      [
        'carrier',
        'bookingCode',
        'currency',
        'distanceKm',
        'mode',
        'notes',
        'price',
        'seat',
        'serviceNumber',
        'status',
        'title',
      ].sort(),
    )
  })
})

describe('the chain arithmetic', () => {
  it('holds N−1 legs after an insert', () => {
    const chain = splitLegAt(chainFromTransport(transport()), 0)

    expect(chain.stations).toHaveLength(3)
    expect(chain.legs).toHaveLength(2)
  })

  it('holds N−1 legs after a removal', () => {
    const chain = removeStationAt(threeStations(), 1)

    expect(chain.stations).toHaveLength(2)
    expect(chain.legs).toHaveLength(1)
  })

  it('holds N−1 legs after both, at every step', () => {
    let chain = chainFromTransport(transport())
    for (const step of [0, 1, 0, 2]) {
      chain = splitLegAt(chain, step)
      expect(chain.legs).toHaveLength(chain.stations.length - 1)
    }
    for (const step of [2, 1, 3]) {
      chain = removeStationAt(chain, step)
      expect(chain.legs).toHaveLength(chain.stations.length - 1)
    }
    expect(chain.stations).toHaveLength(3)
  })

  it('inserts the new station between the two the leg joined', () => {
    const chain = splitLegAt(chainFromTransport(transport()), 0)

    expect(chain.stations.map((station) => station.name)).toEqual([
      'Shin-Osaka',
      '',
      'Tokyo',
    ])
  })

  /**
   * The traveller is adding a change of train, not retyping their ticket: the
   * first half keeps everything it had and the second half inherits the facts
   * that are still true of it.
   */
  it('carries the service number and the seat to the second half', () => {
    const chain = splitLegAt(chainFromTransport(transport()), 0)

    expect(chain.legs[0]).toMatchObject({
      serviceNumber: 'Hikari 500',
      seat: '7-11A',
      departureDate: '2026-04-10',
      departureTime: '09:00',
    })
    expect(chain.legs[1]).toMatchObject({
      serviceNumber: 'Hikari 500',
      seat: '7-11A',
      arrivalDate: '2026-04-10',
      arrivalTime: '12:40',
    })
  })

  it('leaves the new join with no times, because nobody has typed them', () => {
    const chain = splitLegAt(chainFromTransport(transport()), 0)

    expect(chain.legs[0].arrivalTime).toBe('')
    expect(chain.legs[0].arrivalDate).toBe('')
    expect(chain.legs[1].departureTime).toBe('')
  })

  it('joins the two legs either side of a removed middle station', () => {
    const chain = removeStationAt(threeStations(), 1)

    expect(chain.legs[0]).toMatchObject({
      serviceNumber: 'Hikari 500',
      departureTime: '09:00',
      arrivalTime: '12:40',
    })
    expect(chain.stations.map((station) => station.name)).toEqual([
      'Shin-Osaka',
      'Tokyo',
    ])
  })

  it('drops the outer leg when an end station is removed', () => {
    const chain = removeStationAt(threeStations(), 0)

    expect(chain.stations).toHaveLength(2)
    expect(chain.stations[0].name).toBe('')
    expect(chain.stations[1].name).toBe('Tokyo')
  })

  it('refuses to take a chain below two stations', () => {
    const chain = chainFromTransport(transport())

    expect(removeStationAt(chain, 0)).toBe(chain)
    expect(removeStationAt(chain, 1)).toBe(chain)
  })

  it('refuses to split past the cap', () => {
    let chain = chainFromTransport(transport())
    while (chain.legs.length < CHAIN_MAX_LEGS) {
      chain = splitLegAt(chain, 0)
    }

    expect(chain.legs).toHaveLength(CHAIN_MAX_LEGS)
    expect(splitLegAt(chain, 0)).toBe(chain)
  })

  it('ignores a leg index that is not on the chain', () => {
    const chain = chainFromTransport(transport())

    expect(splitLegAt(chain, 4)).toBe(chain)
    expect(splitLegAt(chain, -1)).toBe(chain)
    expect(removeStationAt(chain, 9)).toBe(chain)
  })

  it('gives every station and leg a key of its own', () => {
    const chain = splitLegAt(splitLegAt(chainFromTransport(transport()), 0), 1)
    const keys = [
      ...chain.stations.map((station) => station.key),
      ...chain.legs.map((leg) => leg.key),
    ]

    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('what a station is called in a control’s accessible name', () => {
  it('is its name, its code, or its place in the chain', () => {
    expect(stationLabel(emptyStation(), 2, modulesTranslate)).toBe('stop 3')
    expect(
      stationLabel({ ...emptyStation(), code: 'NGO' }, 1, modulesTranslate),
    ).toBe('NGO')
    expect(
      stationLabel({ ...emptyStation(), name: 'Nagoya' }, 1, modulesTranslate),
    ).toBe('Nagoya')
  })
})

describe('what the chain refuses to save', () => {
  /** The middle station named, which is what the traveller does next. */
  function named(): ChainDraft {
    const chain = threeStations()
    return {
      ...chain,
      stations: chain.stations.map((station, index) =>
        index === 1 ? { ...station, name: 'Nagoya' } : station,
      ),
    }
  }

  it('accepts a chain whose stations are all named', () => {
    const errors = validateChain(named(), 'train', [])
    expect(hasChainErrors(errors)).toBe(false)
  })

  /**
   * A freshly inserted stop is blank on purpose — the traveller has to say where
   * they change — so the one thing a chain always refuses is an unnamed station.
   */
  it('names the station that has no name', () => {
    const errors = validateChain(threeStations(), 'train', [])

    expect(hasChainErrors(errors)).toBe(true)
    expect(errors.stations?.[1]?.name).toBeDefined()
    expect(errors.stations?.[0]?.name).toBeUndefined()
  })

  it('refuses a leg that lands before it leaves', () => {
    const chain = chainFromTransport(
      transport({ arrivalDate: '2026-04-09', arrivalTime: '08:00' }),
    )
    const errors = validateChain(chain, 'train', [])

    expect(hasChainErrors(errors)).toBe(true)
    expect(errors.legs?.[0]?.arrivalTime).toBeDefined()
  })

  it('refuses a leg whose arrival day precedes its departure day', () => {
    const chain = chainFromTransport(
      transport({ departureDayId: 'day-3', arrivalDayId: 'day-1' }),
    )
    const errors = validateChain(chain, 'train', [
      { id: 'day-1', dayNumber: 1 },
      { id: 'day-3', dayNumber: 3 },
    ])

    expect(errors.legs?.[0]?.arrivalDayId).toBeDefined()
  })

  /**
   * A zone is what makes a stored time readable anywhere else, so a name the
   * platform cannot resolve is refused here rather than written and silently
   * read as `UTC` by every reader afterwards.
   */
  it('refuses a zone the platform does not know', () => {
    const chain = chainFromTransport(transport())
    const wrong: ChainDraft = {
      ...chain,
      stations: [
        { ...chain.stations[0], timezone: 'Mars/Olympus_Mons' },
        { ...chain.stations[1], timezone: 'Asia/Tokyo' },
      ],
    }
    const errors = validateChain(wrong, 'train', [])

    expect(errors.stations?.[0]?.timezone).toBeDefined()
    expect(errors.stations?.[1]?.timezone).toBeUndefined()
  })
})

describe('the payload the chain is saved as', () => {
  it('sends N stations and N−1 legs, trimmed', () => {
    const chain = splitLegAt(chainFromTransport(transport()), 0)
    const payload = chainPayload({
      ...chain,
      stations: [
        chain.stations[0],
        { ...chain.stations[1], name: '  Nagoya  ', code: ' ngo ' },
        chain.stations[2],
      ],
    })

    expect(payload.stations).toHaveLength(3)
    expect(payload.legs).toHaveLength(2)
    expect(payload.stations[1]).toMatchObject({ name: 'Nagoya', code: 'NGO' })
  })

  it('sends nothing at all for a chain nobody broke up', () => {
    expect(chainPayload(chainFromTransport(transport()))).toEqual({
      stations: [],
      legs: [],
    })
  })
})

/**
 * The catalogue, which is a shortcut over free text and never a gate in front of
 * it.
 *
 * Two different intents reach the same station row and they must not behave the
 * same way, which is the whole reason there are two functions rather than one:
 *
 * - **Picking a row** from the type-ahead is an explicit choice. The traveller
 *   looked at "NRT · Narita International" and chose it, so it replaces what was
 *   in the fields — refusing to would leave them staring at a row they picked and
 *   a name they did not.
 * - **Typing a code** into the free-text field is a hint. The catalogue fills the
 *   blanks around it and touches nothing the traveller wrote, because a lookup
 *   that overwrites a name somebody typed has turned a shortcut into a gate.
 *
 * Neither ever clears a field: the catalogue is a cut taken on the day the
 * artefact was built, so "it does not carry a zone for this row" is a fact about
 * the artefact and never a statement about the airport.
 */
describe('filling a station from the catalogue', () => {
  const NARITA: StationLookup = {
    code: 'NRT',
    name: 'Narita International Airport',
    timezone: 'Asia/Tokyo',
    lat: 35.7647,
    lng: 140.386,
  }

  describe('when the traveller picked the row', () => {
    it('replaces the fields with what they picked', () => {
      const filled = applyStationMatch(
        { ...emptyStation(), name: 'Haneda', code: 'HND' },
        NARITA,
      )

      expect(filled).toMatchObject({
        name: 'Narita International Airport',
        code: 'NRT',
        timezone: 'Asia/Tokyo',
        lat: 35.7647,
        lng: 140.386,
      })
    })

    it('keeps the zone already chosen when the catalogue carries none', () => {
      const filled = applyStationMatch(
        { ...emptyStation(), timezone: 'Asia/Tokyo' },
        { ...NARITA, timezone: null },
      )

      expect(filled.timezone).toBe('Asia/Tokyo')
    })

    it('leaves the row’s key alone, so React does not remount the field', () => {
      const station = emptyStation()
      expect(applyStationMatch(station, NARITA).key).toBe(station.key)
    })
  })

  describe('when the traveller only typed a code', () => {
    it('fills the blanks around it', () => {
      const filled = fillStationFromCode(emptyStation(), NARITA)

      expect(filled).toMatchObject({
        name: 'Narita International Airport',
        code: 'NRT',
        timezone: 'Asia/Tokyo',
        lat: 35.7647,
        lng: 140.386,
      })
    })

    /** The one rule that separates a shortcut from a gate. */
    it('never overwrites a name or a zone the traveller wrote', () => {
      const filled = fillStationFromCode(
        {
          ...emptyStation(),
          name: 'The old terminal',
          timezone: 'Asia/Seoul',
        },
        NARITA,
      )

      expect(filled.name).toBe('The old terminal')
      expect(filled.timezone).toBe('Asia/Seoul')
      // The code is still canonicalised: it is the field they typed into.
      expect(filled.code).toBe('NRT')
    })

    it('leaves a coordinate pair the traveller already has', () => {
      const filled = fillStationFromCode(
        { ...emptyStation(), lat: 1.5, lng: 2.5 },
        NARITA,
      )

      expect(filled).toMatchObject({ lat: 1.5, lng: 2.5 })
    })

    it('fills a coordinate pair only as a pair, never half of one', () => {
      const filled = fillStationFromCode(emptyStation(), {
        ...NARITA,
        lng: null,
      })

      expect(filled).toMatchObject({ lat: null, lng: null })
    })
  })
})

/**
 * Which codes are worth asking the catalogue about.
 *
 * The lookup runs when a traveller leaves the code field, so the predicate is
 * what stops a request per keystroke-worth-of-nonsense: an IATA code is three
 * characters and an ICAO code is four, and anything else is either half-typed or
 * not a code at all.
 */
describe('a code worth looking up', () => {
  it('accepts an IATA and an ICAO code, in any case', () => {
    expect(isLookupCode('NRT')).toBe(true)
    expect(isLookupCode('RJAA')).toBe(true)
    expect(isLookupCode('  nrt ')).toBe(true)
  })

  it('refuses anything that is not one', () => {
    for (const value of ['', 'N', 'NR', 'NARITA', 'NR T', 'NR-T']) {
      expect(isLookupCode(value)).toBe(false)
    }
  })
})

/**
 * The address a late answer uses.
 *
 * The code lookup in the editor is a server round trip started when the traveller leaves the code
 * field, and a traveller does not stop typing while it is in the air. Everything here is about the
 * gap between "the lookup started" and "the lookup answered": the answer has to land on the
 * station as it stands *then*, not rebuild it from the snapshot the lookup was started with.
 */
describe('a station edit that resolves late', () => {
  it('applies to the station as it stands, not as it was', () => {
    const chain = threeStations()
    const key = chain.stations[1].key

    // The traveller types a name while the lookup for the code is still in flight.
    const meanwhile = updateStationByKey(chain, key, (current) => ({
      ...current,
      name: 'Typed while waiting',
    }))
    // And now the answer lands, carrying only what it knows.
    const resolved = updateStationByKey(meanwhile, key, (current) => ({
      ...current,
      code: 'NRT',
    }))

    expect(resolved.stations[1].name).toBe('Typed while waiting')
    expect(resolved.stations[1].code).toBe('NRT')
  })

  it('follows the station when a stop is inserted before it', () => {
    const chain = threeStations()
    const key = chain.stations[2].key
    const moved = splitLegAt(chain, 0)

    expect(moved.stations[2].key).not.toBe(key)
    const resolved = updateStationByKey(moved, key, (current) => ({
      ...current,
      code: 'HND',
    }))

    expect(resolved.stations.find((station) => station.key === key)?.code).toBe(
      'HND',
    )
    // And nobody else was touched.
    expect(
      resolved.stations.filter((station) => station.code === 'HND'),
    ).toHaveLength(1)
  })

  it('changes nothing when the stop was removed while the answer was in the air', () => {
    const chain = threeStations()
    const key = chain.stations[1].key
    const without = removeStationAt(chain, 1)

    expect(updateStationByKey(without, key, () => emptyStation())).toBe(without)
  })

  it('keeps the chain arithmetic', () => {
    const chain = threeStations()
    const resolved = updateStationByKey(
      chain,
      chain.stations[0].key,
      (current) => ({ ...current, timezone: 'Asia/Tokyo' }),
    )

    expect(resolved.legs).toHaveLength(resolved.stations.length - 1)
    expect(resolved.legs).toEqual(chain.legs)
  })
})

/**
 * The door in, and the one thing it must carry through with it.
 *
 * Breaking a journey up is a change of editor and never a change of journey, so
 * what the traveller has already typed has to survive the press. Both readings
 * of that were broken in the same way: a transport being added has no record to
 * read the endpoints back from, and a transport being edited has one that is
 * out of date the moment anything is typed above.
 */
describe('breaking a journey into legs', () => {
  it('opens on the stations typed into the flat form, not on a blank pair', () => {
    const draft = {
      ...emptyLegDraft('EUR'),
      departureName: 'Lisboa Oriente',
      departureCode: 'LIS',
      departureDate: '2026-05-04',
      departureTime: '08:10',
      arrivalName: 'Porto Campanhã',
      arrivalCode: 'OPO',
      arrivalDate: '2026-05-04',
      arrivalTime: '11:05',
      serviceNumber: 'AP 125',
      seat: '12F',
    }

    const broken = breakIntoLegs(emptyChain(), draft)

    expect(broken.broken).toBe(true)
    expect(broken.stations.map((station) => station.name)).toEqual([
      'Lisboa Oriente',
      'Porto Campanhã',
    ])
    expect(broken.legs).toHaveLength(1)
    expect(broken.legs[0].departureTime).toBe('08:10')
    expect(broken.legs[0].arrivalTime).toBe('11:05')
    expect(broken.legs[0].serviceNumber).toBe('AP 125')
  })

  /**
   * The half the record cannot answer for. The chain is read from the stored
   * transport when the dialog opens; an edit typed after that lives only in the
   * draft, and seeding from the record would drop it on the floor at the press.
   */
  it('prefers an edit typed since the dialog opened over the stored record', () => {
    const record = transport()
    const draft = {
      ...emptyLegDraft('EUR'),
      departureName: 'Kyoto',
      departureCode: 'UKY',
      departureDate: record.departureDate ?? '',
      departureTime: '10:30',
      arrivalName: record.arrivalName ?? '',
      arrivalCode: record.arrivalCode ?? '',
      arrivalDate: record.arrivalDate ?? '',
      arrivalTime: record.arrivalTime ?? '',
    }

    const broken = breakIntoLegs(flatChain(record), draft)

    expect(broken.stations[0].name).toBe('Kyoto')
    expect(broken.legs[0].departureTime).toBe('10:30')
  })

  it('leaves a chain that is already broken exactly as it stands', () => {
    const chained = chainFromTransport(transport({ legs: RECORDED_LEGS }))

    expect(breakIntoLegs(chained, emptyLegDraft('EUR'))).toBe(chained)
  })
})
