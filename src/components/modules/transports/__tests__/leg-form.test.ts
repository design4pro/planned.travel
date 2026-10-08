import { describe, expect, it } from 'vitest'

import {
  TRANSPORT_MODES,
  TRANSPORT_STATUSES,
  breakIntoLegs,
  chainPayload,
  dayLabel,
  emptyChain,
  emptyChainLeg,
  emptyStation,
  emptyTransportDraft,
  endpointLabels,
  flatChain,
  hasTransportErrors,
  isTransportMode,
  isTransportStatus,
  kilometresToMetres,
  metresToKilometres,
  modeLabel,
  priceToMinor,
  splitLegAt,
  suggestTransportTitle,
  transportPayload,
  transportStatusLabel,
  usesCodes,
  usesSeat,
  usesService,
  validateTransportDraft,
} from '../leg-form'

import { modulesTranslate as t } from '#/lib/i18n/__tests__/modules-translate'
import { CHAIN_MAX_LEGS, CHAIN_MAX_STATIONS } from '#/lib/transport-chain'
import { saveTransportSchema } from '#/server/fns/transport-wire'

import type { ChainDraft, TransportDraft } from '../leg-form'

function draft(overrides: Partial<TransportDraft> = {}): TransportDraft {
  return {
    ...emptyTransportDraft('EUR'),
    title: 'Flight to Tokyo',
    ...overrides,
  }
}

describe('mode and status vocabulary', () => {
  it('accepts every mode and status the schema stores', () => {
    for (const mode of TRANSPORT_MODES) {
      expect(isTransportMode(mode)).toBe(true)
      expect(modeLabel(mode).length).toBeGreaterThan(0)
    }
    for (const status of TRANSPORT_STATUSES) {
      expect(isTransportStatus(status)).toBe(true)
      expect(transportStatusLabel(status).length).toBeGreaterThan(0)
    }
  })

  it('labels an unknown token rather than rendering it raw', () => {
    expect(modeLabel('hovercraft')).toBe('modules.transports.mode.fallback')
    expect(transportStatusLabel('maybe')).toBe(
      'modules.transports.mode.fallback',
    )
  })

  it('asks for codes only where a traveller would read one off a ticket', () => {
    expect(usesCodes('flight')).toBe(true)
    expect(usesCodes('train')).toBe(true)
    expect(usesCodes('walk')).toBe(false)
    expect(usesCodes('taxi')).toBe(false)
  })

  it('asks for a service number only where services are numbered', () => {
    expect(usesService('flight')).toBe(true)
    expect(usesService('car')).toBe(false)
  })

  it('asks for a seat only where seats are assigned', () => {
    expect(usesSeat('train')).toBe(true)
    expect(usesSeat('ferry')).toBe(false)
  })

  it('names each end of a transport the way the mode does', () => {
    expect(endpointLabels('flight').from).toBe(
      'modules.transports.end.fromAirport',
    )
    expect(endpointLabels('flight').to).toBe('modules.transports.end.toAirport')
    expect(endpointLabels('ferry').from).toBe('modules.transports.end.fromPort')
    expect(endpointLabels('train').from).toBe(
      'modules.transports.end.fromStation',
    )
  })

  /**
   * The hire-car case, which is the whole point of the relabelling: nobody says
   * a car departs. All five keys come from the one function, so the endpoint
   * legend, the day select and the error under them can never drift apart.
   */
  it('describes a hire car as picked up and returned', () => {
    expect(endpointLabels('car')).toEqual({
      from: 'modules.transports.end.pickUp',
      to: 'modules.transports.end.dropOff',
      fromDay: 'modules.transports.end.pickUpDay',
      toDay: 'modules.transports.end.returnDay',
      dayOrder: 'modules.transports.error.returnDayBeforePickUp',
    })
  })

  it('leaves every other mode on departure and arrival', () => {
    for (const mode of TRANSPORT_MODES) {
      if (mode === 'car') {
        continue
      }
      const labels = endpointLabels(mode)
      expect(labels.fromDay).toBe('modules.transports.end.departureDay')
      expect(labels.toDay).toBe('modules.transports.end.arrivalDay')
      expect(labels.dayOrder).toBe(
        'modules.transports.error.arrivalDayBeforeDeparture',
      )
    }
    expect(endpointLabels('hovercraft')).toEqual({
      from: 'modules.transports.end.from',
      to: 'modules.transports.end.to',
      fromDay: 'modules.transports.end.departureDay',
      toDay: 'modules.transports.end.arrivalDay',
      dayOrder: 'modules.transports.error.arrivalDayBeforeDeparture',
    })
  })
})

/**
 * The two day references, which are what this form gained: a journey leaves on
 * one day and lands on another, and nothing derives the second from the first.
 */
describe('the days a transport covers', () => {
  const DAYS = [
    { id: 'day-1', dayNumber: 1 },
    { id: 'day-2', dayNumber: 2 },
    { id: 'day-3', dayNumber: 3 },
  ]

  it('starts a draft with neither day chosen', () => {
    expect(emptyTransportDraft('EUR').departureDayId).toBe('')
    expect(emptyTransportDraft('EUR').arrivalDayId).toBe('')
  })

  it('accepts a draft with no day at all, because an idea has no day', () => {
    expect(hasTransportErrors(validateTransportDraft(draft(), DAYS))).toBe(
      false,
    )
    expect(hasTransportErrors(validateTransportDraft(draft()))).toBe(false)
  })

  it('accepts a night flight that lands the next day', () => {
    expect(
      validateTransportDraft(
        draft({ departureDayId: 'day-2', arrivalDayId: 'day-3' }),
        DAYS,
      ).arrivalDayId,
    ).toBeUndefined()
  })

  it('accepts both ends on the same day', () => {
    expect(
      validateTransportDraft(
        draft({ departureDayId: 'day-2', arrivalDayId: 'day-2' }),
        DAYS,
      ).arrivalDayId,
    ).toBeUndefined()
  })

  it('refuses an arrival day earlier than the departure day', () => {
    expect(
      validateTransportDraft(
        draft({ departureDayId: 'day-3', arrivalDayId: 'day-1' }),
        DAYS,
      ).arrivalDayId,
    ).toBe('modules.transports.error.arrivalDayBeforeDeparture')
  })

  it('says it in the words the mode uses', () => {
    expect(
      validateTransportDraft(
        draft({ mode: 'car', departureDayId: 'day-3', arrivalDayId: 'day-1' }),
        DAYS,
      ).arrivalDayId,
    ).toBe('modules.transports.error.returnDayBeforePickUp')
  })

  it('says nothing about one end chosen without the other', () => {
    expect(
      hasTransportErrors(
        validateTransportDraft(draft({ departureDayId: 'day-3' }), DAYS),
      ),
    ).toBe(false)
    expect(
      hasTransportErrors(
        validateTransportDraft(draft({ arrivalDayId: 'day-1' }), DAYS),
      ),
    ).toBe(false)
  })

  /**
   * A day id the list does not carry cannot be ordered against anything, and a
   * form that refused it would refuse a draft the reader cannot repair. The
   * repository is the rule; this is the convenience.
   */
  it('ignores a day the list does not know', () => {
    expect(
      hasTransportErrors(
        validateTransportDraft(
          draft({ departureDayId: 'day-3', arrivalDayId: 'gone' }),
          DAYS,
        ),
      ),
    ).toBe(false)
  })
})

describe('suggestTransportTitle', () => {
  it('builds a name from the carrier and both codes', () => {
    expect(
      suggestTransportTitle(
        draft({ carrier: 'SAS', departureCode: 'lhr', arrivalCode: 'hnd' }),
      ),
    ).toEqual({
      key: 'modules.transports.title.fromTo',
      params: { operator: 'SAS', from: 'LHR', to: 'HND' },
      operatorKey: null,
    })
  })

  it('falls back to the mode when there is no carrier', () => {
    expect(
      suggestTransportTitle(
        draft({
          mode: 'train',
          departureName: 'Tokyo',
          arrivalName: 'Kyoto',
        }),
      ),
    ).toEqual({
      key: 'modules.transports.title.fromTo',
      params: { from: 'Tokyo', to: 'Kyoto' },
      operatorKey: 'modules.transports.mode.train',
    })
  })

  it('prefers a code over a name', () => {
    expect(
      suggestTransportTitle(
        draft({
          carrier: 'JR',
          departureName: 'Tokyo Station',
          departureCode: 'TYO',
          arrivalName: 'Kyoto',
        }),
      ),
    ).toEqual({
      key: 'modules.transports.title.fromTo',
      params: { operator: 'JR', from: 'TYO', to: 'Kyoto' },
      operatorKey: null,
    })
  })

  it('copes with only one end filled in', () => {
    expect(
      suggestTransportTitle(draft({ carrier: 'SAS', arrivalCode: 'HND' })),
    ).toEqual({
      key: 'modules.transports.title.to',
      params: { operator: 'SAS', to: 'HND' },
      operatorKey: null,
    })
    expect(
      suggestTransportTitle(draft({ carrier: 'SAS', departureCode: 'LHR' })),
    ).toEqual({
      key: 'modules.transports.title.from',
      params: { operator: 'SAS', from: 'LHR' },
      operatorKey: null,
    })
  })

  it('suggests nothing when neither end is known', () => {
    expect(suggestTransportTitle(draft({ carrier: 'SAS' }))).toBeNull()
  })
})

describe('validateTransportDraft', () => {
  it('accepts a complete transport', () => {
    expect(
      hasTransportErrors(
        validateTransportDraft(
          draft({
            departureCode: 'LHR',
            departureDate: '2026-04-16',
            departureTime: '08:00',
            arrivalCode: 'HND',
            arrivalDate: '2026-04-17',
            arrivalTime: '06:30',
            distanceKm: '9560',
            price: '640.50',
          }),
        ),
      ),
    ).toBe(false)
  })

  it('insists on a name', () => {
    expect(validateTransportDraft(draft({ title: '  ' })).title).toBeDefined()
  })

  it('rejects a name longer than the column', () => {
    expect(
      validateTransportDraft(draft({ title: 'x'.repeat(200) })).title,
    ).toBeDefined()
  })

  it('rejects a malformed date and time', () => {
    const errors = validateTransportDraft(
      draft({ departureDate: '16/04/2026', departureTime: '25:00' }),
    )
    expect(errors.departureDate).toBeDefined()
    expect(errors.departureTime).toBeDefined()
  })

  it('refuses a time with no date to sit on', () => {
    expect(
      validateTransportDraft(draft({ departureTime: '08:00' })).departureDate,
    ).toBe('modules.transports.error.departureNeedsDate')
    expect(
      validateTransportDraft(draft({ arrivalTime: '08:00' })).arrivalDate,
    ).toBe('modules.transports.error.arrivalNeedsDate')
  })

  it('refuses a transport that arrives before it departs', () => {
    expect(
      validateTransportDraft(
        draft({
          departureDate: '2026-04-16',
          departureTime: '12:00',
          arrivalDate: '2026-04-16',
          arrivalTime: '08:00',
        }),
      ).arrivalDate,
    ).toBe('modules.transports.error.arrivesBeforeDeparts')
  })

  it('does not let the ordering message hide a malformed date', () => {
    const errors = validateTransportDraft(
      draft({
        departureDate: '2026-04-16',
        arrivalDate: 'nonsense',
      }),
    )
    expect(errors.arrivalDate).toBe('modules.transports.error.date')
  })

  it('rejects a station code that is not a code', () => {
    expect(
      validateTransportDraft(draft({ departureCode: 'L' })).departureCode,
    ).toBeDefined()
    expect(
      validateTransportDraft(draft({ arrivalCode: 'TOO-LONG-HERE' }))
        .arrivalCode,
    ).toBeDefined()
    expect(
      validateTransportDraft(draft({ departureCode: 'lhr' })).departureCode,
    ).toBeUndefined()
  })

  it('rejects a distance that is not a number of kilometres', () => {
    expect(
      validateTransportDraft(draft({ distanceKm: 'far' })).distanceKm,
    ).toBeDefined()
    expect(
      validateTransportDraft(draft({ distanceKm: '-5' })).distanceKm,
    ).toBeDefined()
    expect(
      validateTransportDraft(draft({ distanceKm: '9,560' })).distanceKm,
    ).toBeUndefined()
  })

  it('rejects a price it cannot read', () => {
    expect(
      validateTransportDraft(draft({ price: 'about 600' })).price,
    ).toBeDefined()
  })

  it('reports every problem at once', () => {
    const errors = validateTransportDraft(
      draft({ title: '', departureCode: 'X', distanceKm: 'far' }),
    )
    expect(Object.keys(errors).sort()).toEqual([
      'departureCode',
      'distanceKm',
      'title',
    ])
  })
})

describe('distance conversion', () => {
  it('converts kilometres to whole metres', () => {
    expect(kilometresToMetres('9560')).toBe(9_560_000)
    expect(kilometresToMetres('12.5')).toBe(12_500)
  })

  it('accepts a comma decimal', () => {
    expect(kilometresToMetres('12,5')).toBe(12_500)
  })

  it('reads an empty or unusable field as nothing recorded', () => {
    expect(kilometresToMetres('')).toBe(0)
    expect(kilometresToMetres('far')).toBe(0)
    expect(kilometresToMetres('-5')).toBe(0)
  })

  it('round-trips through the input format', () => {
    expect(metresToKilometres(kilometresToMetres('12.5'))).toBe('12.5')
    expect(metresToKilometres(kilometresToMetres('450'))).toBe('450')
  })

  it('shows nothing for an unrecorded distance', () => {
    expect(metresToKilometres(null)).toBe('')
    expect(metresToKilometres(0)).toBe('')
  })
})

describe('price conversion', () => {
  it('converts a price to whole minor units', () => {
    expect(priceToMinor('133.20')).toBe(13_320)
    expect(priceToMinor('9')).toBe(900)
  })

  it('accepts a comma decimal, as half the catalogue writes one', () => {
    expect(priceToMinor('133,20')).toBe(13_320)
  })

  it('reads an empty or unusable field as nothing recorded', () => {
    expect(priceToMinor('')).toBe(0)
    expect(priceToMinor('   ')).toBe(0)
    expect(priceToMinor('free')).toBe(0)
    expect(priceToMinor('-20')).toBe(0)
    expect(priceToMinor('0')).toBe(0)
  })
})

/**
 * The draft-to-wire mapping, as a function rather than a submit closure.
 *
 * The hazard this seam exists for is named in `src/server/fns/transports.ts`
 * itself: "an object schema strips a key it does not declare, so a column the
 * screen sets and the validator has never heard of is a column written null with
 * every test still green". While the mapping lived inside the dialog's `submit()`
 * the only way to check it was to render the dialog and press the button. Here it
 * is a call, and the two day references — the pair with no second writer — are
 * asserted directly.
 */
describe('the draft as the record writers take it', () => {
  const TRIP = 'trip-42'

  /** Exactly what the dialog hands the save: the record, the row's id, its intent and the chain. */
  function savePayload(transportDraft: TransportDraft, chain: ChainDraft) {
    return {
      ...transportPayload(transportDraft, chain, TRIP),
      transportId: 'draft-1',
      intent: 'create' as const,
      ...chainPayload(chain),
    }
  }

  /** A broken chain of `stationCount` named stations, built past the editor's own cap if asked. */
  function chainOfStations(stationCount: number): ChainDraft {
    let chain = breakIntoLegs(emptyChain(), {
      departureName: 'Start',
      departureCode: 'AAA',
      departureDate: '2026-10-09',
      departureTime: '08:00',
      departureDayId: '',
      arrivalName: 'End',
      arrivalCode: 'ZZZ',
      arrivalDate: '2026-10-09',
      arrivalTime: '20:00',
      arrivalDayId: '',
      serviceNumber: null,
      seat: null,
    })
    while (chain.stations.length < stationCount) {
      chain =
        chain.legs.length < CHAIN_MAX_LEGS
          ? splitLegAt(chain, 0)
          : {
              ...chain,
              stations: [...chain.stations, emptyStation()],
              legs: [...chain.legs, emptyChainLeg()],
            }
    }
    return {
      ...chain,
      stations: chain.stations.map((station, index) => ({
        ...station,
        name: `Station ${index}`,
      })),
    }
  }

  function filled(): TransportDraft {
    return draft({
      mode: 'train',
      status: 'confirmed',
      title: '  Shinkansen to Kyoto  ',
      carrier: 'JR Central',
      serviceNumber: 'Nozomi 21',
      bookingCode: 'ABC123',
      seat: '7A',
      departureName: 'Tokyo',
      departureCode: 'TYO',
      departureDate: '2026-10-09',
      departureTime: '21:30',
      departureDayId: 'day-3',
      arrivalName: 'Kyoto',
      arrivalCode: 'KYO',
      arrivalDate: '2026-10-10',
      arrivalTime: '06:45',
      arrivalDayId: 'day-4',
      distanceKm: '476,5',
      price: '133,20',
      currency: 'EUR',
      notes: 'Window seat',
    })
  }

  it('carries every field the traveller filled in through to the wire', () => {
    expect(transportPayload(filled(), emptyChain(), TRIP)).toEqual({
      tripId: TRIP,
      mode: 'train',
      status: 'confirmed',
      title: 'Shinkansen to Kyoto',
      carrier: 'JR Central',
      serviceNumber: 'Nozomi 21',
      bookingCode: 'ABC123',
      seat: '7A',
      departureName: 'Tokyo',
      departureCode: 'TYO',
      departureDate: '2026-10-09',
      departureTime: '21:30',
      departureDayId: 'day-3',
      arrivalName: 'Kyoto',
      arrivalCode: 'KYO',
      arrivalDate: '2026-10-10',
      arrivalTime: '06:45',
      arrivalDayId: 'day-4',
      distanceMetres: 476_500,
      priceMinor: 13_320,
      currency: 'EUR',
      notes: 'Window seat',
    })
  })

  /**
   * The night train leaves on day 3 and lands on day 4, and only the traveller
   * knows that. Both references are stated separately and neither is derived, so
   * losing one is silent — the record simply anchors to a day nobody chose.
   */
  it('keeps the two day references apart', () => {
    const payload = transportPayload(filled(), emptyChain(), TRIP)
    expect(payload.departureDayId).toBe('day-3')
    expect(payload.arrivalDayId).toBe('day-4')
  })

  /**
   * The binding to the server's contract: the payload goes through the validator the save runs.
   *
   * A field this builder forgets is a parse failure, and a field it sets that the validator does
   * not declare is a key the parsed value no longer has — an object schema strips what it does not
   * know, which is how a column ends up written null with every other test green.
   */
  it('fills exactly the fields the write validator declares', () => {
    const input = savePayload(filled(), emptyChain())
    const parsed = saveTransportSchema.parse(input)
    expect(Object.keys(parsed).sort()).toEqual(Object.keys(input).sort())
  })

  it('blanks the currency of a price nobody recorded', () => {
    const payload = transportPayload(
      draft({ price: '', currency: 'EUR' }),
      emptyChain(),
      TRIP,
    )
    expect(payload.priceMinor).toBe(0)
    expect(payload.currency).toBe('')
  })

  /**
   * Once a journey is broken into legs the record's endpoints are written from the
   * chain's *outer* stations, not from the flat fields the dialog has hidden — and
   * not from whatever station happens to sit in the middle.
   */
  it('writes the endpoints from the outer stations of a broken chain', () => {
    const broken = splitLegAt(
      breakIntoLegs(emptyChain(), {
        departureName: '  Tokyo  ',
        departureCode: ' tyo ',
        departureDate: '2026-10-09',
        departureTime: '21:30',
        departureDayId: 'day-3',
        arrivalName: '  Kyoto  ',
        arrivalCode: ' kyo ',
        arrivalDate: '2026-10-10',
        arrivalTime: '06:45',
        arrivalDayId: 'day-4',
        serviceNumber: null,
        seat: null,
      }),
      0,
    )
    const payload = transportPayload(filled(), broken, TRIP)
    expect(payload.departureName).toBe('Tokyo')
    expect(payload.arrivalName).toBe('Kyoto')
    expect(broken.stations).toHaveLength(3)
  })

  /**
   * The server decides no day: the pair this builds is the pair that is stored. From the first
   * and the last leg once the journey is broken, from the draft otherwise.
   */
  it('takes the record’s days from the first and last leg of a broken chain', () => {
    const broken = splitLegAt(
      breakIntoLegs(emptyChain(), {
        departureName: 'Tokyo',
        departureCode: 'TYO',
        departureDate: '2026-10-09',
        departureTime: '21:30',
        departureDayId: 'leg-day-1',
        arrivalName: 'Kyoto',
        arrivalCode: 'KYO',
        arrivalDate: '2026-10-10',
        arrivalTime: '06:45',
        arrivalDayId: 'leg-day-2',
        serviceNumber: null,
        seat: null,
      }),
      0,
    )
    const payload = transportPayload(filled(), broken, TRIP)
    expect(payload.departureDayId).toBe(broken.legs.at(0)?.departureDayId)
    expect(payload.arrivalDayId).toBe(broken.legs.at(-1)?.arrivalDayId)
    expect(payload.departureDayId).toBe('leg-day-1')
    expect(payload.arrivalDayId).toBe('leg-day-2')
  })

  /**
   * The record is written before its chain, and the repository orders it in its own zones: the
   * westbound clocks copied from the outer legs are only in order in the zones they were
   * validated in, so those zones travel with them.
   */
  it('sends the outer stations’ zones with the endpoints a chain owns', () => {
    const chain = breakIntoLegs(emptyChain(), {
      departureName: 'Narita',
      departureCode: 'NRT',
      departureDate: '2026-04-16',
      departureTime: '21:00',
      departureDayId: '',
      arrivalName: 'Honolulu',
      arrivalCode: 'HNL',
      arrivalDate: '2026-04-16',
      arrivalTime: '09:00',
      arrivalDayId: '',
      serviceNumber: null,
      seat: null,
    })
    const zoned: ChainDraft = {
      ...chain,
      stations: chain.stations.map((station, index) => ({
        ...station,
        timezone: index === 0 ? ' Asia/Tokyo ' : 'Pacific/Honolulu',
      })),
    }
    const payload = transportPayload(filled(), zoned, TRIP)
    expect(payload.departureTimezone).toBe('Asia/Tokyo')
    expect(payload.arrivalTimezone).toBe('Pacific/Honolulu')
  })

  it('sends no zones for a journey nobody has broken up', () => {
    const payload = transportPayload(filled(), emptyChain(), TRIP)
    expect(payload).not.toHaveProperty('departureTimezone')
    expect(payload).not.toHaveProperty('arrivalTimezone')
  })

  /**
   * The mirror of the case above, and the compatibility claim of the chain stage:
   * a journey nobody has broken up is its own two endpoints. Its stations exist —
   * the editor needs something to show — but they are a reading of the record, not
   * a second source of truth, so the flat fields win.
   */
  it('keeps the typed endpoints while the journey is still one movement', () => {
    const unbroken = flatChain({
      departureName: 'Somewhere else',
      departureCode: 'XXX',
      departureDate: '2020-01-01',
      departureTime: '00:00',
      departureDayId: 'day-99',
      arrivalName: 'Nowhere',
      arrivalCode: 'YYY',
      arrivalDate: '2020-01-02',
      arrivalTime: '23:59',
      arrivalDayId: 'day-98',
      serviceNumber: null,
      seat: null,
    })
    expect(unbroken.broken).toBe(false)
    const payload = transportPayload(filled(), unbroken, TRIP)
    expect(payload.departureName).toBe('Tokyo')
    expect(payload.arrivalName).toBe('Kyoto')
    expect(payload.departureDayId).toBe('day-3')
    expect(payload.arrivalDayId).toBe('day-4')
  })

  describe('the chain as the validator counts it', () => {
    it('accepts the empty chain of a journey nobody broke up', () => {
      const parsed = saveTransportSchema.parse(
        savePayload(filled(), emptyChain()),
      )
      expect(parsed.stations).toEqual([])
      expect(parsed.legs).toEqual([])
    })

    it('accepts two stations and the cap, and refuses one more than the cap', () => {
      for (const count of [2, CHAIN_MAX_STATIONS]) {
        const chain = chainOfStations(count)
        expect(chain.stations).toHaveLength(count)
        expect(
          saveTransportSchema.safeParse(savePayload(filled(), chain)).success,
        ).toBe(true)
      }

      const tooLong = chainOfStations(CHAIN_MAX_STATIONS + 1)
      expect(tooLong.legs).toHaveLength(CHAIN_MAX_LEGS + 1)
      expect(
        saveTransportSchema.safeParse(savePayload(filled(), tooLong)).success,
      ).toBe(false)
    })
  })
})

/**
 * What a day is called in the two selects. The day number leads, because that is
 * how a person refers to a day of their own trip; what follows disambiguates it.
 */
describe('naming a day of the trip', () => {
  it('leads with the day number and disambiguates with the title', () => {
    expect(
      dayLabel(
        { dayNumber: 3, date: '2026-10-09', title: 'Arashiyama' },
        t,
        'en',
      ),
    ).toBe('Day 3 · Arashiyama')
  })

  /**
   * `Fri 9 Oct`, not `2026-10-09`. A stored date is a machine's spelling of a day
   * and this is a label a person reads, so it goes through the same shared
   * formatter the timeline uses — which answers from a CLDR table rather than
   * from the platform's ICU build (`12-verification-protocol.md` §7.2).
   */
  it('writes the date the way a person reads one when a day has no title', () => {
    expect(
      dayLabel({ dayNumber: 3, date: '2026-10-09', title: null }, t, 'en'),
    ).toBe('Day 3 · Fri 9 Oct')
    expect(
      dayLabel({ dayNumber: 3, date: '2026-10-09', title: '' }, t, 'en'),
    ).toBe('Day 3 · Fri 9 Oct')
  })

  it('says the number alone when there is nothing to disambiguate with', () => {
    expect(dayLabel({ dayNumber: 7, date: null, title: null }, t, 'en')).toBe(
      'Day 7',
    )
  })

  it('falls back to the stored date rather than dropping an unreadable one', () => {
    expect(
      dayLabel({ dayNumber: 2, date: 'not-a-date', title: null }, t, 'en'),
    ).toBe('Day 2 · not-a-date')
  })
})
