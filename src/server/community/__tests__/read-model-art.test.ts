import { describe, expect, it } from 'vitest'
import { reduceTripArt } from '../read-model'

describe('approved coordinate art reduction', () => {
  it('handles empty, one and coincident points deterministically', () => {
    expect(reduceTripArt([])).toEqual([])
    const point = { day: 0, longitude: 12, latitude: 34 }
    expect(reduceTripArt([point])).toEqual([
      { x: 0.5, y: 0.5, startsSegment: true },
    ])
    const points = [point, point]
    expect(reduceTripArt(points)).toEqual(reduceTripArt(points))
    expect(reduceTripArt(points)[1]).toEqual({
      x: 0.5,
      y: 0.5,
      startsSegment: false,
    })
  })

  it('normalizes the complete set before taking the specified ordered sample', () => {
    const points = Array.from({ length: 65 }, (_, i) => ({
      day: 0,
      longitude: i === 1 ? 100 : i,
      latitude: i,
    }))
    const art = reduceTripArt(points)
    expect(art).toHaveLength(32)
    expect(art[1]?.x).toBe(0.02)
    expect(art.at(-1)?.x).toBe(0.64)
    expect(
      art.every(
        ({ x, y }) =>
          Number.isFinite(x) &&
          Number.isFinite(y) &&
          x >= 0 &&
          x <= 1 &&
          y >= 0 &&
          y <= 1,
      ),
    ).toBe(true)
  })

  it('keeps dateline neighbours together and never connects different sampled days', () => {
    const art = reduceTripArt([
      { day: 0, longitude: 179, latitude: 0 },
      { day: 0, longitude: -179, latitude: 1 },
      { day: 1, longitude: 178, latitude: 2 },
    ])
    expect(art.map((p) => p.x)).toEqual([1 / 3, 1, 0])
    expect(art.map((p) => p.startsSegment)).toEqual([true, false, true])
    expect(
      reduceTripArt(
        Array.from({ length: 40 }, (_, day) => ({
          day,
          longitude: day,
          latitude: day,
        })),
      ).every((p) => p.startsSegment),
    ).toBe(true)
  })

  it('omits invalid coordinates', () => {
    expect(
      reduceTripArt([
        { day: 0, longitude: NaN, latitude: 0 },
        { day: 1, longitude: 0, latitude: 91 },
      ]),
    ).toEqual([])
  })
})
