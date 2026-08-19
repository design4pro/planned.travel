/**
 * The atlas world map.
 *
 * A country tracker whose headline is a bar chart is a spreadsheet with ambition.
 * The whole point of the feature is the shape of what you have and have not been
 * to, and only a map says that. This one is drawn from the outlines bundled in
 * `#/lib/map/world` — no tiles, no WebGL, no network — so it renders identically
 * on the server, in the client, offline, and in a screenshot, and it is coloured
 * entirely from the product's own tokens rather than someone else's cartography.
 *
 * Plate carrée, not Mercator. Mercator inflates the empty north until Greenland
 * outweighs Africa, which is exactly the wrong emphasis for a map about places
 * people go. The equirectangular grid keeps every degree the same size, so the
 * lit area is an honest picture of coverage.
 */

import * as React from 'react'

import { cn } from '#/lib/cn'
import { ringsToPath, worldOutlines } from '#/lib/map/world'

import type { Projection, WorldRing } from '#/lib/map/world'

/* ------------------------------------------------------------------ geometry */

/**
 * The drawing space. 2000 units of longitude keeps a unit at a fifth of a degree,
 * which lands under half a device pixel at any width this card is ever given —
 * so path coordinates round to whole numbers and the geometry inlined into the
 * server-rendered document stays about a third smaller than a decimal would be.
 */
const VIEW_WIDTH = 2000
/** Northern Greenland and the southern tip of Patagonia, and nothing wasted. */
const LAT_TOP = 82
const LAT_BOTTOM = -56
const VIEW_HEIGHT = Math.round(
  (VIEW_WIDTH * (LAT_TOP - LAT_BOTTOM)) / 360,
)

const project: Projection = (lng, lat) => [
  ((lng + 180) / 360) * VIEW_WIDTH,
  ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * VIEW_HEIGHT,
]

let allLand: string | null = null

/** Every country, as one path. Built once: it never changes. */
function landPath(): string {
  if (allLand === null) {
    const rings: Array<WorldRing> = []
    for (const outline of worldOutlines().values()) rings.push(...outline)
    allLand = ringsToPath(rings, project, 0)
  }
  return allLand
}

/** Only the countries in `codes`, as one path. */
function visitedPath(codes: ReadonlyArray<string>): string {
  const outlines = worldOutlines()
  const rings: Array<WorldRing> = []
  for (const code of codes) {
    const outline = outlines.get(code.toUpperCase())
    if (outline !== undefined) rings.push(...outline)
  }
  return ringsToPath(rings, project, 0)
}

/* ------------------------------------------------------------------- drawing */

export interface WorldCoverageMapProps {
  /** ISO 3166-1 alpha-2 codes to light up. Unknown codes are ignored. */
  readonly visited: ReadonlyArray<string>
  /** Read out to assistive technology in place of the drawing. */
  readonly label: string
  readonly className?: string
}

export function WorldCoverageMap({
  visited,
  label,
  className,
}: WorldCoverageMapProps) {
  const key = React.useMemo(
    () => [...visited].map((code) => code.toUpperCase()).sort().join(','),
    [visited],
  )
  const lit = React.useMemo(
    () => (key === '' ? '' : visitedPath(key.split(','))),
    [key],
  )

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      className={cn('block h-auto w-full', className)}
      role="img"
      aria-label={label}
    >
      {/* Unvisited land: present, legible, and quiet enough that the lit
          countries are the only thing the eye lands on. */}
      <path
        d={landPath()}
        fill="var(--color-inverse-surface)"
        stroke="var(--color-inverse-edge)"
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
      {lit === '' ? null : (
        <path
          d={lit}
          fill="var(--color-inverse-brand)"
          stroke="var(--color-inverse)"
          strokeWidth={1.1}
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}
