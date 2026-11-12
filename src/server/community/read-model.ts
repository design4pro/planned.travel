import { boundsForPoints, isValidLngLat, wrapLongitude } from '#/lib/map/bounds'

export interface TripArtPoint {
  readonly x: number
  readonly y: number
  readonly startsSegment: boolean
}

export interface ApprovedArtCoordinate {
  readonly day: number
  readonly longitude: number
  readonly latitude: number
}

/** Release-time decoration only; approved itinerary coordinates remain complete. */
export function reduceTripArt(
  coordinates: ReadonlyArray<ApprovedArtCoordinate>,
): ReadonlyArray<TripArtPoint> {
  const valid = coordinates.filter((p) =>
    isValidLngLat([p.longitude, p.latitude]),
  )
  const bounds = boundsForPoints(
    valid.map((p) => [p.longitude, p.latitude] as const),
  )
  if (!bounds) return []
  const south = Math.min(...valid.map((p) => p.latitude))
  const north = Math.max(...valid.map((p) => p.latitude))
  const normalized = valid.map((p) => {
    let longitude = wrapLongitude(p.longitude)
    if (longitude < bounds.west) longitude += 360
    return {
      day: p.day,
      x:
        bounds.east === bounds.west
          ? 0.5
          : (longitude - bounds.west) / (bounds.east - bounds.west),
      y: north === south ? 0.5 : (north - p.latitude) / (north - south),
    }
  })
  const count = Math.min(normalized.length, 32)
  let previousDay: number | undefined
  return Array.from({ length: count }, (_, i) => {
    const index =
      count === 1 ? 0 : Math.floor((i * (normalized.length - 1)) / (count - 1))
    const point = normalized[index]
    if (!point) throw new Error('Missing art sample')
    const startsSegment = i === 0 || point.day !== previousDay
    previousDay = point.day
    return { x: point.x, y: point.y, startsSegment }
  })
}
