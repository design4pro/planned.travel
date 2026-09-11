import { describe, expect, it } from 'vitest'

import { TRANSPORT_MODES } from '#/components/modules/transports/vocabulary'
import { legItemId } from '../ordering'
import { expandJourneyRows, transportPhases } from '../transport-rows'

import type { Journey } from '../transport-rows'

/** The trip's days, in order — what turns two day references into a range. */
const DAYS = ['d1', 'd2', 'd3', 'd4']

const journey: Journey = {
  kind: 'transport',
  id: 't1',
  departureDayId: 'd1',
  arrivalDayId: 'd1',
  mode: 'train',
  status: 'confirmed',
  serviceNumber: 'Nozomi 21',
  fromName: 'Tokyo',
  toName: 'Kyoto',
  departureLabel: '09:00',
  arrivalLabel: '12:30',
  rangeLabel: '09:00 – 12:30',
  price: '¥13,320',
  position: 1.5,
}

describe('what a journey’s parts are called', () => {
  it('answers for every mode the vocabulary has', () => {
    for (const mode of TRANSPORT_MODES) {
      const phases = transportPhases(mode)
      expect(phases.departing).toMatch(/^trips\.plan\.transport\.phase\./)
      expect(phases.travelling).toMatch(/^trips\.plan\.transport\.phase\./)
      expect(phases.arriving).toMatch(/^trips\.plan\.transport\.phase\./)
    }
  })

  it('gives a flight the air triple and a hire car the hire triple', () => {
    expect(transportPhases('flight').travelling).toBe(
      'trips.plan.transport.phase.flight.travelling',
    )
    expect(transportPhases('car').arriving).toBe(
      'trips.plan.transport.phase.hire.arriving',
    )
  })

  it('gives the other ten modes, and a mode it has never heard of, the generic triple', () => {
    const generic = TRANSPORT_MODES.filter(
      (mode) => mode !== 'flight' && mode !== 'car',
    )
    expect(generic).toHaveLength(10)
    for (const mode of generic) {
      expect(transportPhases(mode).departing).toBe(
        'trips.plan.transport.phase.journey.departing',
      )
    }
    // The column's CHECK came after the rows did, so an unknown mode still gets words.
    expect(transportPhases('hovercraft').departing).toBe(
      'trips.plan.transport.phase.journey.departing',
    )
  })
})

describe('cutting a journey into the rows its days show', () => {
  it('gives a three-day journey the first, middle and last labels', () => {
    const rows = expandJourneyRows(
      { ...journey, arrivalDayId: 'd3', mode: 'flight' },
      DAYS,
    )

    expect(rows.map((row) => row.dayId)).toEqual(['d1', 'd2', 'd3'])
    expect(rows.map((row) => row.part)).toEqual([
      'departing',
      'travelling',
      'arriving',
    ])
    expect(rows.map((row) => row.phase)).toEqual([
      'trips.plan.transport.phase.flight.departing',
      'trips.plan.transport.phase.flight.travelling',
      'trips.plan.transport.phase.flight.arriving',
    ])
    // Only the two ends carry a clock; the day in between is the whole day.
    expect(rows.map((row) => row.time)).toEqual(['09:00', null, '12:30'])
    // One journey, three draggable identities.
    expect(new Set(rows.map((row) => row.itemId)).size).toBe(3)
    expect(rows[0].itemId).toBe(legItemId('transport', 'd1', 't1'))
  })

  it('gives a one-day journey one row, the range, and no label at all', () => {
    const rows = expandJourneyRows(journey, DAYS)

    expect(rows).toHaveLength(1)
    expect(rows[0].part).toBe('departing')
    expect(rows[0].phase).toBeNull()
    expect(rows[0].time).toBe('09:00 – 12:30')
    expect(rows[0].position).toBe(1.5)
  })

  it('places a record that only arrives as an arriving row, with no label', () => {
    const rows = expandJourneyRows(
      { ...journey, departureDayId: null, arrivalDayId: 'd2' },
      DAYS,
    )

    expect(rows).toHaveLength(1)
    expect(rows[0].dayId).toBe('d2')
    expect(rows[0].part).toBe('arriving')
    expect(rows[0].phase).toBeNull()
    expect(rows[0].time).toBe('12:30')
  })

  it('draws nothing for a journey with no day, or a day this trip does not have', () => {
    expect(
      expandJourneyRows(
        { ...journey, departureDayId: null, arrivalDayId: null },
        DAYS,
      ),
    ).toEqual([])
    expect(
      expandJourneyRows(
        { ...journey, departureDayId: 'gone', arrivalDayId: null },
        DAYS,
      ),
    ).toEqual([])
  })

  it('draws a journey arriving before it departs on its departure day alone', () => {
    const rows = expandJourneyRows(
      { ...journey, departureDayId: 'd3', arrivalDayId: 'd1' },
      DAYS,
    )

    expect(rows.map((row) => row.dayId)).toEqual(['d3'])
    expect(rows[0].part).toBe('departing')
  })

  it('expands each leg of a chain in its own place, and no row spans the chain', () => {
    const legs: ReadonlyArray<Journey> = [
      {
        ...journey,
        kind: 'leg',
        id: 'l1',
        departureDayId: 'd1',
        arrivalDayId: 'd1',
      },
      {
        ...journey,
        kind: 'leg',
        id: 'l2',
        departureDayId: 'd2',
        arrivalDayId: 'd3',
      },
      {
        ...journey,
        kind: 'leg',
        id: 'l3',
        departureDayId: 'd4',
        arrivalDayId: 'd4',
      },
    ]

    const rows = legs.flatMap((leg) => expandJourneyRows(leg, DAYS))

    expect(rows.map((row) => [row.id, row.dayId])).toEqual([
      ['l1', 'd1'],
      ['l2', 'd2'],
      ['l2', 'd3'],
      ['l3', 'd4'],
    ])
    expect(rows.every((row) => row.kind === 'leg')).toBe(true)
  })

  it('carries the journey’s own details onto every row it produces', () => {
    const rows = expandJourneyRows({ ...journey, arrivalDayId: 'd3' }, DAYS)

    for (const row of rows) {
      expect(row.id).toBe('t1')
      expect(row.mode).toBe('train')
      expect(row.status).toBe('confirmed')
      expect(row.serviceNumber).toBe('Nozomi 21')
      expect(row.fromName).toBe('Tokyo')
      expect(row.toName).toBe('Kyoto')
      expect(row.price).toBe('¥13,320')
    }
  })
})
