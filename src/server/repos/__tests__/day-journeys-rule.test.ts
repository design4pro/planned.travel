/**
 * Where a journey sits on a day's number line: the arithmetic and the three rules a run is read
 * under, asserted on the rule itself (`../day-journeys`).
 *
 * Every writer of a day shares it: `reorderDayTimelines` against the numbering it produces, and
 * `scheduleAssignment`, `unscheduleAssignment` and `deletePlaceWithJourneys` against the numbering
 * already stored. The writes are asserted in `day-journeys.test.ts` and `day-writes-journeys.test.ts`.
 */

import { describe, expect, it } from 'vitest'

import { byDayRun, placeJourneys, resolveDayRun } from '../day-journeys'
import type { DayRunEntry, DayRunItemInput } from '../day-journeys'

const stop = (id: string): DayRunItemInput => ({ kind: 'stop', id })
const note = (id: string): DayRunItemInput => ({ kind: 'note', id })
const journey = (id: string): DayRunItemInput => ({ kind: 'transport', id })

/** The ruler as a write would hand it over: the stored position of each stop and note. */
function ruler(positions: Record<string, number>): ReadonlyMap<string, number> {
  return new Map(
    Object.entries(positions).map(([key, position]) => [key, position]),
  )
}

function valuesOf(
  placed: ReadonlyArray<{
    readonly ref: DayRunItemInput
    readonly position: number
  }>,
): Record<string, number> {
  return Object.fromEntries(
    placed.map(({ ref, position }) => [ref.id, position]),
  )
}

describe('placeJourneys', () => {
  it('places a journey strictly between the stored positions of its neighbours', () => {
    const placed = placeJourneys(
      [stop('a'), journey('j'), stop('b')],
      ruler({ 'stop/a': 0, 'stop/b': 1 }),
    )

    expect(valuesOf(placed)).toEqual({ j: 0.5 })
  })

  it('takes an open end one unit wide, at either end and on an empty day', () => {
    const placed = placeJourneys(
      [journey('ahead'), stop('only'), journey('behind')],
      ruler({ 'stop/only': 0 }),
    )
    expect(valuesOf(placed)).toEqual({ ahead: -0.5, behind: 0.5 })

    expect(valuesOf(placeJourneys([journey('alone')], ruler({})))).toEqual({
      alone: 0.5,
    })
  })

  it('splits one gap between two journeys, in the order the run names them', () => {
    const placed = placeJourneys(
      [stop('a'), journey('late'), journey('early'), stop('b')],
      ruler({ 'stop/a': 0, 'stop/b': 1 }),
    )

    const values = valuesOf(placed)
    expect(values.late).toBeCloseTo(1 / 3, 10)
    expect(values.early).toBeCloseTo(2 / 3, 10)
  })

  it('names the gap from stored positions, not from a count of entries', () => {
    // The day an unschedule leaves behind: stops at 0 and 2, with nothing at 1.
    const placed = placeJourneys(
      [stop('a'), stop('b'), journey('j')],
      ruler({ 'stop/a': 0, 'stop/b': 2 }),
    )

    // An index formula would write 1.5 — ahead of the second stop it was dropped behind.
    expect(valuesOf(placed)).toEqual({ j: 2.5 })
  })

  it('places a journey behind a stop stored at a midpoint', () => {
    const placed = placeJourneys(
      [stop('a'), stop('mid'), journey('j'), stop('b')],
      ruler({ 'stop/a': 0, 'stop/mid': 0.5, 'stop/b': 1 }),
    )

    expect(valuesOf(placed)).toEqual({ j: 0.75 })
  })
})

describe('resolveDayRun', () => {
  function stored(entries: Array<[DayRunItemInput, number]>) {
    return entries
      .map(([ref, position]): DayRunEntry => ({ ref, position }))
      .sort(byDayRun)
  }

  it('returns the day in its stored order when nothing was requested', () => {
    const current = stored([
      [stop('a'), 0],
      [journey('j'), 0.5],
      [stop('b'), 1],
    ])

    expect(resolveDayRun(current)).toEqual([stop('a'), journey('j'), stop('b')])
  })

  it('counts a journey the request omitted among the journeys sharing its gap', () => {
    const current = stored([
      [stop('a'), 0],
      [journey('named'), 0],
      [journey('omitted'), 0.5],
      [stop('b'), 1],
    ])

    const wanted = resolveDayRun(current, [
      stop('a'),
      journey('named'),
      stop('b'),
    ])
    const placed = placeJourneys(wanted, ruler({ 'stop/a': 0, 'stop/b': 1 }))

    // Both are rewritten together, so the named one cannot land on the omitted one's value.
    expect(wanted).toEqual([
      stop('a'),
      journey('named'),
      journey('omitted'),
      stop('b'),
    ])
    const values = valuesOf(placed)
    expect(values.named).toBeCloseTo(1 / 3, 10)
    expect(values.omitted).toBeCloseTo(2 / 3, 10)
  })

  it('rebuilds a journey tied with a note after that note', () => {
    // `sort_order` defaults to 0 — the value every journey on disk held before it was placed.
    const current = stored([
      [note('n'), 0],
      [stop('s'), 1],
      [journey('j'), 0],
    ])

    const wanted = resolveDayRun(current, [note('n'), stop('s')])
    const placed = placeJourneys(wanted, ruler({ 'note/n': 0, 'stop/s': 1 }))

    expect(wanted).toEqual([note('n'), journey('j'), stop('s')])
    expect(valuesOf(placed)).toEqual({ j: 0.5 })
  })

  it('drops an id the day does not hold and an id named twice', () => {
    const current = stored([
      [stop('a'), 0],
      [journey('here'), 0.5],
    ])

    const wanted = resolveDayRun(current, [
      journey('elsewhere'),
      stop('a'),
      stop('a'),
      journey('here'),
    ])

    expect(wanted).toEqual([stop('a'), journey('here')])
  })
})
