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
 * **The same frame the map opens on, to the pixel.** An equirectangular sheet is
 * the more honest projection for a coverage map, and it was what this drew when
 * it was a card in a scrolling dashboard. As the understudy for a Mercator canvas
 * it is the wrong choice: every landmass shifts as the real map fades in, which
 * reads as a glitch rather than as a hand-off. It drew Web Mercator over a
 * hand-picked latitude window for a while, which was closer and still wrong — the
 * window's centre was 18°N against the camera's 14°S, and the world jumped about
 * 130px vertically on the hand-off at 1440. So the drawing space is now the whole
 * Mercator square, scaled to cover the container, which is *definitionally* the
 * camera's `log2(edge / 512)` opening zoom; and the square is lifted by
 * {@link WORLD_FRAME_CSS}.lift, which is the offset from the equator to
 * {@link WORLD_CENTRE} capped exactly where MapLibre caps the camera. Nothing
 * moves on the hand-off.
 *
 * The cost is Mercator's own: Greenland and Antarctica arrive inflated, and the
 * inhabited world is smaller than a hand-picked window would draw it. That is
 * what the live map shows, and looking like the map it stands in for is this
 * element's entire purpose.
 *
 * **Container query units, not a measurement.** The frame is stated in `cqw` and
 * `cqh` against a size container, so the server-rendered document already has the
 * world in the right place. A measured frame would need an effect, which lands
 * after the first paint, which is a visible jump and a layout shift in exchange
 * for arithmetic the browser can do itself.
 *
 * **The same palette as the live layer.** Both fills come from the
 * `--color-country-*` ramp that `mapPalette().country` mirrors, so every landmass
 * is the same colour before and after the hand-off. The sea is the one thing that
 * changes: this draws land on the page's own canvas, and the basemap brings its
 * water with it.
 *
 * **One visited fill, not the ramp.** `visitRecency()` reads a client-side clock,
 * and this element is server-rendered; banding it would print one colour into the
 * HTML and possibly another on hydration whenever the two straddle a threshold.
 * A single "visited" fill is the same shade the middle of the ramp already means,
 * and the live map applies the banding a moment later.
 */

import * as React from 'react'

import { cn } from '#/lib/cn'
import { WORLD_FRAME_CSS, mercatorY } from '#/lib/atlas/layout'
import { ringsToPath, worldOutlines } from '#/lib/map/world'

import type { Projection, WorldRing } from '#/lib/map/world'

/* ------------------------------------------------------------------ geometry */

/**
 * The drawing space: the Web Mercator square, in 2048 units a side.
 *
 * Square because that is the shape of the world MapLibre draws — `x` runs the
 * full 360° of longitude and `y` the full ±85.051129° Mercator can render — and
 * 2048 because it puts a unit at about a fifth of a degree, which lands under
 * half a device pixel at any width this is ever given. Path coordinates therefore
 * round to whole numbers, and the geometry inlined into the server-rendered
 * document stays about a third smaller than a decimal would be.
 */
const VIEW_SIZE = 2048

const project: Projection = (lng, lat) => [
  ((lng + 180) / 360) * VIEW_SIZE,
  mercatorY(lat) * VIEW_SIZE,
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

/**
 * The frame, as custom properties resolved by the browser.
 *
 * Declared on the size container and read by the square inside it, so the `cqw`
 * and `cqh` in them resolve against the container rather than against whichever
 * element happens to carry the declaration.
 */
const frameStyle = {
  '--atlas-world-edge': WORLD_FRAME_CSS.edge,
  '--atlas-world-lift': WORLD_FRAME_CSS.lift,
} as React.CSSProperties

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
    <div
      // `@container-size` rather than plain `@container`: the lift is stated
      // against the container's *block* size, and `cqh` is only available on a
      // size container. Safe here because the box is `absolute inset-0` inside a
      // slice of definite height, so its own size cannot depend on its contents.
      className={cn('@container-size relative overflow-hidden', className)}
      style={frameStyle}
    >
      <svg
        viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
        // The element's own box is square and so is the viewBox, so this is a
        // formality — stated anyway, because the whole point of the frame is that
        // the drawing is never letterboxed and never stretched.
        preserveAspectRatio="xMidYMid slice"
        className="absolute top-1/2 left-1/2 h-(--atlas-world-edge) w-(--atlas-world-edge)"
        /* `translate`, not `transform`: this is the centring offset, not
           motion, and it must survive the reduced-motion reset the way
           `ui/progress.tsx`'s fill does. */
        style={{
          translate: '-50% calc(-50% - var(--atlas-world-lift, 0px))',
        }}
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
    </div>
  )
}
