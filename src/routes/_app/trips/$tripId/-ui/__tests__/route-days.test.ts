import { describe, expect, it } from 'vitest'

import { dayHandoffs } from '#/lib/geo/handoff'
import { createTranslator } from '#/lib/i18n'
import {
  routeCollection,
  routeLengthMetres,
  tripLengthMetres,
} from '#/lib/map/routes'
import { planBoard } from '../plan-board'
import { routeDaysOf } from '../plan-model'
import {
  board,
  day,
  journey,
  note,
  notes,
  stop,
  transports,
} from './plan-board-fixtures'

import type { PlanTransport } from '../../-server/plan-transports'

function project(
  journeys: ReadonlyArray<PlanTransport>,
  missing: ReadonlyArray<number> = [],
) {
  const payload = board([
    day(
      'd1',
      1,
      Array.from({ length: 8 }, (_, i) => stop(`a${i}`, `p${i}`, i * 2)),
    ),
    day('d2', 2, [stop('other1', 'p8', 0), stop('other2', 'p9', 1)]),
  ])
  const placed = {
    ...payload,
    places: payload.places.map((place, i) => ({
      ...place,
      lat: missing.includes(i) ? null : i,
      lng: 10,
    })),
  }
  const read = planBoard(
    placed,
    notes([note('n1', 'd1', 2.5)]),
    transports(journeys),
  )
  const model = read.model(read.serverOrder, createTranslator('en', {}))
  return { days: model.days, routes: routeDaysOf(model.days) }
}

const points = (indices: ReadonlyArray<number>) =>
  indices.map((lat) => [10, lat])

describe('routeDaysOf through planner, map geometry and distance', () => {
  it.each(['flight', 'ferry', 'train'] as const)(
    'splits at a cancelled %s and retains Day identity',
    (mode) => {
      const { routes } = project([
        journey('j1', { mode, status: 'cancelled', position: 7 }),
      ])
      const geometry = routeCollection(routes).features
      expect(geometry.map((feature) => feature.properties.day)).toEqual([
        1, 1, 2,
      ])
      expect(geometry.map((feature) => feature.geometry.coordinates)).toEqual([
        points([0, 1, 2, 3]),
        points([4, 5, 6, 7]),
        points([8, 9]),
      ])
      expect(new Set(geometry.map((feature) => feature.id)).size).toBe(3)
      expect(tripLengthMetres(routes)).toBeCloseTo(
        routeLengthMetres([
          [10, 0],
          [10, 3],
        ]) +
          routeLengthMetres([
            [10, 4],
            [10, 7],
          ]) +
          routeLengthMetres([
            [10, 8],
            [10, 9],
          ]),
        6,
      )
    },
  )

  it('keeps all map stops beyond the hand-off cap and leaves unsplit geometry unchanged', () => {
    const { days, routes } = project([
      journey('local', { mode: 'bus', position: 7 }),
    ])
    expect(
      routeCollection(routes).features.map(
        (feature) => feature.geometry.coordinates,
      ),
    ).toEqual([points([0, 1, 2, 3, 4, 5, 6, 7]), points([8, 9])])
    expect(dayHandoffs(days[0].items)).toMatchObject([{ total: 8, carried: 5 }])
    expect(tripLengthMetres(routes)).toBeCloseTo(
      routeLengthMetres([
        [10, 0],
        [10, 7],
      ]) +
        routeLengthMetres([
          [10, 8],
          [10, 9],
        ]),
      6,
    )
  })

  it('does not cap a split route stretch at the hand-off provider limit', () => {
    const { days, routes } = project([
      journey('j1', { mode: 'train', position: 13 }),
    ])
    expect(routeCollection(routes).features[0].geometry.coordinates).toEqual(
      points([0, 1, 2, 3, 4, 5, 6]),
    )
    expect(dayHandoffs(days[0].items)).toMatchObject([
      { kind: 'directions', total: 7, carried: 5 },
      { kind: 'point', total: 1, carried: 1 },
    ])
  })

  it('never reconnects across missing points, adjacent journeys or singleton sides', () => {
    const { routes } = project(
      [
        journey('first', { mode: 'flight', position: -1 }),
        journey('middle1', { mode: 'train', position: 3 }),
        journey('middle2', { mode: 'ferry', position: 3.5 }),
        journey('middle3', { mode: 'flight', position: 11 }),
        journey('last', { mode: 'train', position: 15 }),
      ],
      [0, 2, 3, 4, 6],
    )
    expect(
      routeCollection(routes).features.map(
        (feature) => feature.geometry.coordinates,
      ),
    ).toEqual([points([8, 9])])
    expect(tripLengthMetres(routes)).toBeCloseTo(
      routeLengthMetres([
        [10, 8],
        [10, 9],
      ]),
      6,
    )
  })
})
