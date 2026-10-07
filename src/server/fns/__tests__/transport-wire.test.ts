/**
 * The wire validators of the Transport writes, loaded without a Worker: the module under test
 * imports no binding, which is what lets a plain test run the schema a server function runs.
 */
import { describe, expect, it } from 'vitest'

import { CHAIN_MAX_LEGS, CHAIN_MAX_STATIONS } from '#/lib/transport-chain'

import {
  saveSearchedConnectionSchema,
  saveTransportSchema,
} from '../transport-wire'

const STATION = {
  name: 'Lisboa',
  code: 'lis',
  lat: null,
  lng: null,
  timezone: '',
}
const LEG = {
  serviceNumber: '',
  platform: '',
  seat: '',
  departureDayId: '',
  arrivalDayId: '',
  departureDate: '',
  departureTime: '',
  arrivalDate: '',
  arrivalTime: '',
}

function chain(stationCount: number, legCount = stationCount - 1) {
  return {
    stations: Array.from({ length: stationCount }, () => STATION),
    legs: Array.from({ length: legCount }, () => LEG),
  }
}

const RECORD = {
  tripId: 'trip-1',
  mode: 'train' as const,
  status: 'pending' as const,
  title: 'Lisboa to Porto',
  departureDayId: '',
  arrivalDayId: '',
  carrier: '',
  serviceNumber: '',
  bookingCode: '',
  seat: '',
  departureName: '',
  departureCode: '',
  departureDate: '',
  departureTime: '',
  arrivalName: '',
  arrivalCode: '',
  arrivalDate: '',
  arrivalTime: '',
  distanceMetres: 0,
  priceMinor: 0,
  currency: '',
  notes: '',
  transportId: 'draft-1',
  intent: 'create' as const,
}

const SEARCHED = {
  tripId: 'trip-1',
  transportId: '',
  mode: 'train' as const,
  title: 'Lisboa to Porto',
  priceMinor: 0,
  currency: '',
}

describe('saveTransportSchema', () => {
  it('accepts an empty chain, two stations and the cap', () => {
    for (const shape of [chain(0, 0), chain(2), chain(CHAIN_MAX_STATIONS)]) {
      expect(
        saveTransportSchema.safeParse({ ...RECORD, ...shape }).success,
      ).toBe(true)
    }
  })

  it('refuses one station, a missing leg and one more than the cap', () => {
    for (const shape of [
      chain(1, 0),
      chain(3, 1),
      chain(CHAIN_MAX_STATIONS + 1),
    ]) {
      expect(
        saveTransportSchema.safeParse({ ...RECORD, ...shape }).success,
      ).toBe(false)
    }
  })

  it('accepts create and edit, and refuses any other intent or none', () => {
    for (const intent of ['create', 'edit']) {
      expect(
        saveTransportSchema.safeParse({ ...RECORD, ...chain(0, 0), intent })
          .success,
      ).toBe(true)
    }
    for (const intent of ['update', '', undefined]) {
      expect(
        saveTransportSchema.safeParse({ ...RECORD, ...chain(0, 0), intent })
          .success,
      ).toBe(false)
    }
  })

  it('names the array a wrong count is about', () => {
    const tooFew = saveTransportSchema.safeParse({ ...RECORD, ...chain(1, 0) })
    const mismatch = saveTransportSchema.safeParse({
      ...RECORD,
      ...chain(3, 1),
    })

    expect(tooFew.error?.issues.map((issue) => issue.path)).toContainEqual([
      'stations',
    ])
    expect(mismatch.error?.issues.map((issue) => issue.path)).toContainEqual([
      'legs',
    ])
  })
})

describe('saveSearchedConnectionSchema', () => {
  it('accepts a route from two stations up to the cap and the empty-string dialect', () => {
    for (const shape of [chain(2), chain(CHAIN_MAX_STATIONS)]) {
      const parsed = saveSearchedConnectionSchema.safeParse({
        ...SEARCHED,
        ...shape,
      })
      expect(parsed.success).toBe(true)
    }
    expect(chain(CHAIN_MAX_STATIONS).legs).toHaveLength(CHAIN_MAX_LEGS)
  })

  it('refuses a found connection with no route, however the counts line up', () => {
    for (const shape of [chain(0, 0), chain(1, 0), chain(3, 1), chain(14)]) {
      expect(
        saveSearchedConnectionSchema.safeParse({ ...SEARCHED, ...shape })
          .success,
      ).toBe(false)
    }
  })
})
