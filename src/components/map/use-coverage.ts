/**
 * Does the basemap actually cover *this* trip?
 *
 * The archive published for planned.travel is a regional cut, so the question has
 * a different answer for a trip to Kyoto and a trip to Lisbon. Answering it from
 * the archive's own header — rather than from a hardcoded bounding box that would
 * go stale the first time the archive is rebuilt — is what lets the map say
 * something true about itself.
 */

import { coverageFor } from '#/lib/map/coverage'
import { useMapContext } from './map-context'

import type { LngLat } from '#/lib/map/bounds'
import type { CoverageReport } from '#/lib/map/coverage'

/**
 * Coverage of a set of coordinates against the live archive.
 *
 * Deliberately unmemoised: a trip has tens of places, four comparisons each, and
 * every caller rebuilds its point array on every render anyway — so a memo keyed
 * on the array's contents would cost more than the arithmetic it saves, and one
 * keyed on its identity would never hit. Everything the callers read off the
 * result is a primitive, so a fresh object each render changes nothing downstream.
 */
export function useArchiveCoverage(
  points: ReadonlyArray<LngLat>,
): CoverageReport {
  const { archive, basemap } = useMapContext()

  // While the probe is in flight the honest answer is "not yet", never
  // "outside": a notice that flashes up and then disappears is worse than
  // silence. Same when there is no archive at all — that is the basemap notice's
  // story to tell, not this one's.
  if (basemap !== 'available' || archive === null) {
    return coverageFor(null, [])
  }
  return coverageFor(archive.bounds, points)
}
