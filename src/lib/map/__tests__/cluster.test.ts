import { describe, expect, it } from 'vitest'

import {
  CLUSTER_MAX_ZOOM,
  CLUSTER_MIN_POINTS,
  CLUSTER_RADIUS_PX,
  TILE_SIZE,
  clusterPoints,
  clusterWeight,
  expansionZoom,
  lngLatToWorld,
  shouldCluster,
} from '../cluster'

import type { Clusterable } from '../cluster'

interface Place extends Clusterable {
  readonly id: string
  readonly lng: number
  readonly lat: number
  readonly name: string
}

function place(id: string, lng: number, lat: number): Place {
  return { id, lng, lat, name: id }
}

/** Two places a fixed number of pixels apart at a given zoom. */
function pairApart(pixels: number, zoom: number): [Place, Place] {
  const scale = TILE_SIZE * 2 ** zoom
  const degreesPerPixel = 360 / scale
  return [place('a', 0, 0), place('b', pixels * degreesPerPixel, 0)]
}

describe('lngLatToWorld', () => {
  it('puts the null island in the middle of the world at zoom 0', () => {
    expect(lngLatToWorld(0, 0, 0)).toEqual({
      x: TILE_SIZE / 2,
      y: TILE_SIZE / 2,
    })
  })

  it('puts the antimeridian at both edges', () => {
    expect(lngLatToWorld(-180, 0, 0).x).toBe(0)
    expect(lngLatToWorld(180, 0, 0).x).toBe(TILE_SIZE)
  })

  it('doubles the world with every zoom step', () => {
    expect(lngLatToWorld(0, 0, 1)).toEqual({ x: TILE_SIZE, y: TILE_SIZE })
    expect(lngLatToWorld(0, 0, 2)).toEqual({
      x: TILE_SIZE * 2,
      y: TILE_SIZE * 2,
    })
  })

  it('clamps beyond the Mercator limit instead of returning infinity', () => {
    expect(Number.isFinite(lngLatToWorld(0, 90, 4).y)).toBe(true)
    expect(Number.isFinite(lngLatToWorld(0, -90, 4).y)).toBe(true)
  })

  it('places northern latitudes above southern ones', () => {
    expect(lngLatToWorld(0, 60, 3).y).toBeLessThan(lngLatToWorld(0, -60, 3).y)
  })
})

describe('shouldCluster', () => {
  it('needs at least two points', () => {
    expect(shouldCluster(4, 1)).toBe(false)
    expect(shouldCluster(4, CLUSTER_MIN_POINTS)).toBe(true)
  })

  it('stops once the reader is reading individual venues', () => {
    expect(shouldCluster(CLUSTER_MAX_ZOOM - 0.01, 10)).toBe(true)
    expect(shouldCluster(CLUSTER_MAX_ZOOM, 10)).toBe(false)
    expect(shouldCluster(CLUSTER_MAX_ZOOM + 3, 10)).toBe(false)
  })

  it('refuses a zoom it cannot reason about', () => {
    expect(shouldCluster(Number.NaN, 10)).toBe(false)
  })
})

describe('clusterPoints', () => {
  it('merges two places closer together than the grid cell', () => {
    const [a, b] = pairApart(CLUSTER_RADIUS_PX / 4, 8)
    const clusters = clusterPoints([a, b], { zoom: 8 })
    expect(clusters).toHaveLength(1)
    expect(clusters[0].isCluster).toBe(true)
    expect(clusters[0].count).toBe(2)
    expect(clusters[0].items.map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('leaves places further apart than the cell alone', () => {
    const [a, b] = pairApart(CLUSTER_RADIUS_PX * 3, 8)
    const clusters = clusterPoints([a, b], { zoom: 8 })
    expect(clusters).toHaveLength(2)
    expect(clusters.every((entry) => !entry.isCluster)).toBe(true)
  })

  it('separates the same two places as the reader zooms in', () => {
    const [a, b] = pairApart(CLUSTER_RADIUS_PX / 2, 8)
    expect(clusterPoints([a, b], { zoom: 8 })).toHaveLength(1)
    // Four zoom steps in, the same gap is sixteen times as many pixels.
    expect(clusterPoints([a, b], { zoom: 12 })).toHaveLength(2)
  })

  it('never clusters at or above the cut-off zoom, however tight the pack', () => {
    const places = [
      place('a', 0, 0),
      place('b', 0.000001, 0),
      place('c', 0, 0.000001),
    ]
    const clusters = clusterPoints(places, { zoom: CLUSTER_MAX_ZOOM })
    expect(clusters).toHaveLength(3)
    expect(clusters.every((entry) => entry.isCluster)).toBe(false)
  })

  it('uses the mean position of its members', () => {
    const cluster = clusterPoints(
      [place('a', 10, 20), place('b', 10.0001, 20.0001)],
      {
        zoom: 4,
      },
    )[0]
    expect(cluster.lng).toBeCloseTo(10.00005, 6)
    expect(cluster.lat).toBeCloseTo(20.00005, 6)
  })

  it('keeps ids stable across renders at the same zoom', () => {
    const places = [
      place('a', 0, 0),
      place('b', 0.01, 0.01),
      place('c', 40, 40),
    ]
    const first = clusterPoints(places, { zoom: 6 })
    const second = clusterPoints([...places].reverse(), { zoom: 6 })
    expect(first.map((entry) => entry.id).sort()).toEqual(
      second.map((entry) => entry.id).sort(),
    )
  })

  it('returns markers north to south, so southern pins paint in front', () => {
    const clusters = clusterPoints(
      [place('south', 0, -40), place('north', 0, 50), place('middle', 0, 10)],
      { zoom: 14 },
    )
    expect(clusters.map((entry) => entry.id)).toEqual([
      'north',
      'middle',
      'south',
    ])
  })

  it('drops places it cannot plot rather than rendering them at the origin', () => {
    const clusters = clusterPoints(
      [
        place('good', 5, 5),
        place('nan', Number.NaN, 5),
        place('polar', 5, 120),
      ],
      { zoom: 14 },
    )
    expect(clusters.map((entry) => entry.id)).toEqual(['good'])
  })

  it('passes a single place straight through as itself', () => {
    const clusters = clusterPoints([place('only', 1, 2)], { zoom: 3 })
    expect(clusters).toEqual([
      {
        id: 'only',
        lng: 1,
        lat: 2,
        items: [place('only', 1, 2)],
        count: 1,
        isCluster: false,
      },
    ])
  })

  it('treats a zero radius as clustering switched off', () => {
    const [a, b] = pairApart(1, 8)
    expect(clusterPoints([a, b], { zoom: 8, radius: 0 })).toHaveLength(2)
  })

  it('honours a caller-supplied radius', () => {
    const [a, b] = pairApart(80, 8)
    expect(clusterPoints([a, b], { zoom: 8 })).toHaveLength(2)
    expect(clusterPoints([a, b], { zoom: 8, radius: 200 })).toHaveLength(1)
  })

  it('handles an empty list', () => {
    expect(clusterPoints([], { zoom: 8 })).toEqual([])
  })
})

describe('clusterWeight', () => {
  it('steps the badge size so three places and three hundred differ', () => {
    expect(clusterWeight(2)).toBe('sm')
    expect(clusterWeight(4)).toBe('sm')
    expect(clusterWeight(5)).toBe('md')
    expect(clusterWeight(14)).toBe('md')
    expect(clusterWeight(15)).toBe('lg')
    expect(clusterWeight(300)).toBe('lg')
  })
})

describe('expansionZoom', () => {
  it('finds the zoom at which a cluster actually breaks apart', () => {
    const [a, b] = pairApart(CLUSTER_RADIUS_PX / 8, 6)
    const cluster = clusterPoints([a, b], { zoom: 6 })[0]
    const target = expansionZoom(cluster, 6)

    expect(target).toBeGreaterThan(6)
    expect(clusterPoints([a, b], { zoom: target })).toHaveLength(2)
    // And one step below it, they were still together.
    expect(clusterPoints([a, b], { zoom: target - 1 })).toHaveLength(1)
  })

  it('gives up at the cut-off for places that share a coordinate', () => {
    const same = [place('a', 12, 34), place('b', 12, 34)]
    const cluster = clusterPoints(same, { zoom: 4 })[0]
    expect(expansionZoom(cluster, 4)).toBe(CLUSTER_MAX_ZOOM)
  })
})
