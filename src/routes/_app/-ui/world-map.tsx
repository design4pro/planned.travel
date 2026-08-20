/**
 * The atlas's ground of last resort.
 *
 * This is **not** the atlas's map. `/atlas` draws the world with a live MapLibre
 * canvas and the `VisitedCountries` layer, which pans, zooms, hit-tests and
 * carries the recency ramp. This file has one job the live canvas cannot do:
 * exist without WebGL.
 *
 * It sits behind the canvas — the canvas is mounted with a transparent ground so
 * this shows through — and it answers two states honestly:
 *
 * - **Before the first painted frame.** The reader sees the world sketched from
 *   the bundled outlines instead of an empty rectangle with a spinner on it.
 *   Once MapLibre reports its style loaded, this fades out under the real map.
 * - **When the engine never starts.** No WebGL2 context, or a renderer that
 *   never draws a frame. `MapCanvas` posts its own designed notice for that; the
 *   world underneath it stays drawn, so the screen still shows where the reader
 *   has been rather than a blank field with an apology on it.
 *
 * Three decisions keep it honest.
 *
 * **Web Mercator, matching the live map.** An equirectangular sheet is the more
 * honest projection for a coverage map, and it was what this drew when it was a
 * card in a scrolling dashboard. As the understudy for a Mercator canvas it is
 * the wrong choice: every landmass would shift as the real map faded in, which
 * reads as a glitch rather than as a hand-off. It therefore projects the same way
 * MapLibre does, over the same latitude window the map opens on.
 *
 * **The same palette as the live layer.** Both fills come from the
 * `--color-country-*` ramp that `mapPalette().country` mirrors, so the hand-off is
 * a change of sharpness rather than a change of colour.
 *
 * **One visited fill, not the ramp.** `visitRecency()` reads a client-side clock,
 * and this element is server-rendered; banding it would print one colour into the
 * HTML and possibly another on hydration whenever the two straddle a threshold.
 * A single "visited" fill is the same shade the middle of the ramp already means,
 * and the live map applies the banding a moment later.
 */

import * as React from 'react'

import { cn } from '#/lib/cn'
import { ringsToPath, worldOutlines } from '#/lib/map/world'

import type { Projection, WorldRing } from '#/lib/map/world'

/* ------------------------------------------------------------------ geometry */

/**
 * The drawing space. 2000 units of longitude keeps a unit at a fifth of a
 * degree, which lands under half a device pixel at any width this is ever given
 * — so path coordinates round to whole numbers and the geometry inlined into the
 * server-rendered document stays about a third smaller than a decimal would be.
 */
const VIEW_WIDTH = 2000

/**
 * The latitude window.
 *
 * 72°N to 56°S is every inhabited degree and no more. Mercator inflates the two
 * ends beyond any use - at 85° a pixel is worth a tenth of what it is worth at
 * the equator - and including them would shrink the part of the world people
 * travel in to make room for ice.
 */
const WORLD_LATITUDE_SPAN = { north: 72, south: -56 } as const

/** Normalised Web Mercator y for a latitude, in `[0, 1]` from the north pole. */
function mercatorY(lat: number): number {
  const clamped = Math.min(Math.max(lat, -85.051129), 85.051129)
  const radians = (clamped * Math.PI) / 180
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + radians / 2)) / (2 * Math.PI)
}

const TOP = mercatorY(WORLD_LATITUDE_SPAN.north)
const BOTTOM = mercatorY(WORLD_LATITUDE_SPAN.south)
const VIEW_HEIGHT = Math.round(VIEW_WIDTH * (BOTTOM - TOP))

const project: Projection = (lng, lat) => [
  ((lng + 180) / 360) * VIEW_WIDTH,
  ((mercatorY(lat) - TOP) / (BOTTOM - TOP)) * VIEW_HEIGHT,
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
  /**
   * Read out to assistive technology in place of the drawing — but only while
   * this *is* the map. Once the live canvas is drawing, it owns the accessible
   * name and this becomes decoration, or two maps are announced where there is
   * one.
   */
  readonly label: string
  /** `true` once the live canvas has taken over. Hides it from the reader. */
  readonly decorative?: boolean
  readonly className?: string
}

export function WorldCoverageMap({
  visited,
  label,
  decorative = false,
  className,
}: WorldCoverageMapProps) {
  const key = React.useMemo(
    () =>
      [...visited]
        .map((code) => code.toUpperCase())
        .sort()
        .join(','),
    [visited],
  )
  const lit = React.useMemo(
    () => (key === '' ? '' : visitedPath(key.split(','))),
    [key],
  )

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      // `meet`, not `slice`: when this is the only map the reader gets, showing
      // the whole world matters more than filling the box edge to edge.
      preserveAspectRatio="xMidYMid meet"
      className={cn('block size-full', className)}
      // `role="img"` with no name is worse than no role, so the two attributes
      // move together.
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : label}
    >
      {/* Unvisited land: present, legible, and quiet enough that the lit
          countries are the only thing the eye lands on. Both fills are the
          tokens the live layer paints with. */}
      <path
        d={landPath()}
        fill="var(--color-country-land)"
        stroke="var(--color-country-land-edge)"
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
      {lit === '' ? null : (
        <path
          d={lit}
          fill="var(--color-country-visited)"
          stroke="var(--color-country-visited-edge)"
          strokeWidth={1.1}
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}
