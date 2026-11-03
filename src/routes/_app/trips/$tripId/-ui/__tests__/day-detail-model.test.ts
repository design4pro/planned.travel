import { describe, expect, it } from 'vitest'
import { dayDetailModel } from '../day-detail-model'
import { plannerDetailReducer } from '../planner-detail-state'
import {
  board,
  booking,
  day,
  notes,
  note,
  stop,
  transports,
} from './plan-board-fixtures'
import { planBoard } from '../plan-board'
import { createTranslator, loadCatalogue } from '#/lib/i18n'

const t = createTranslator('en', await loadCatalogue('en'))

describe('Day details', () => {
  it('opens, minimises, reactivates and replaces in one slot', () => {
    const open = plannerDetailReducer(
      { kind: 'closed' },
      { type: 'day', dayId: 'd1' },
    )
    expect(open).toEqual({ kind: 'day', dayId: 'd1', minimised: false })
    const small = plannerDetailReducer(open, { type: 'minimise' })
    expect(small).toEqual({ kind: 'day', dayId: 'd1', minimised: true })
    expect(plannerDetailReducer(small, { type: 'day', dayId: 'd1' })).toEqual(
      open,
    )
    const place = plannerDetailReducer(small, { type: 'place', placeId: 'p1' })
    expect(place).toEqual({ kind: 'place', placeId: 'p1' })
    expect(plannerDetailReducer(place, { type: 'day', dayId: 'd1' })).toEqual(
      open,
    )
    expect(plannerDetailReducer(open, { type: 'close' })).toEqual({
      kind: 'closed',
    })
  })

  it('joins only exact identifiers, deduplicates and retains the board note order', () => {
    const base = day('d2', 2, [stop('s2', 'p2', 0)], 'Kyoto')
    const stay = {
      id: 'stay',
      name: 'Hotel',
      startDayId: 'd1',
      endDayId: 'd3',
      checkInTime: '14:00',
      checkInEndTime: null,
      checkOutTime: null,
      reservationId: 'hotel',
    }
    const source = {
      ...base,
      stays: [{ ...stay, id: 'later', startDayId: 'd2' }, stay],
    }
    const payload = board([day('d1', 1, []), source, day('d3', 3, [])])
    const b = planBoard(
      payload,
      notes([
        note('late', 'd2', 8),
        note('early', 'd2', 1),
        note('other', 'd1', 0),
      ]),
      transports(),
    )
    const planner = b.model(b.serverOrder, t).days[1]
    const direct = booking('direct', { dayId: 'd2', assignmentId: 's2' })
    const result = dayDetailModel(source, planner, payload.days, [
      direct,
      direct,
      booking('stop', { assignmentId: 's2' }),
      booking('hotel', { confirmationNumber: ' REAL-42 ' }),
      booking('guess', {
        title: 'Hotel',
        startDate: '2026-11-03',
        dayId: 'd1',
      }),
    ])
    expect(result.reservations.map((r) => r.id)).toEqual([
      'direct',
      'stop',
      'hotel',
    ])
    expect(result.stays.map((s) => s.id)).toEqual(['stay', 'later'])
    expect(result.stays[0].confirmation).toBe('REAL-42')
    expect(result.notes.map((n) => n.id)).toEqual(['early', 'late'])
    expect(
      dayDetailModel(source, planner, payload.days, [
        booking('hotel', { confirmationNumber: ' ' }),
      ]).stays[0].confirmation,
    ).toBeNull()
  })
})
