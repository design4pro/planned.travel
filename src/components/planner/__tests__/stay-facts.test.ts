import { describe, expect, it } from 'vitest'

import { stayFactsOn } from '../stay-facts'

import type { PlannerStay } from '../types'

const STAY: PlannerStay = {
  id: 's1',
  name: 'Hotel Roma',
  startDayId: 'd2',
  endDayId: 'd5',
  checkIn: '15:00 – 18:00',
  checkOut: '11:00',
  reservationId: null,
}

/** The words each day of `days` says about the stay, in order. */
function wordsOver(
  days: ReadonlyArray<string>,
  stay: PlannerStay,
): ReadonlyArray<ReadonlyArray<string>> {
  return days.map((dayId) =>
    stayFactsOn(dayId, stay).map((fact) => `${fact.word} ${fact.time}`),
  )
}

describe('stayFactsOn', () => {
  it('is total over the covered range: check in first, the nights bare, check out last', () => {
    expect(wordsOver(['d2', 'd3', 'd4', 'd5'], STAY)).toEqual([
      ['checkIn 15:00 – 18:00'],
      [],
      [],
      ['checkOut 11:00'],
    ])
  })

  it('says both on a stay that begins and ends on the same day', () => {
    expect(wordsOver(['d2'], { ...STAY, endDayId: 'd2' })).toEqual([
      ['checkIn 15:00 – 18:00', 'checkOut 11:00'],
    ])
  })

  it('labels each boundary from the plan’s own copy', () => {
    expect(
      stayFactsOn('d2', { ...STAY, endDayId: 'd2' }).map((fact) => fact.label),
    ).toEqual(['trips.plan.stay.checkIn', 'trips.plan.stay.checkOut'])
  })
})
