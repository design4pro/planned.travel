import * as React from 'react'

import { MAP_FIT_DURATION, cameraMotion } from '#/lib/map/camera'
import {
  boundsForPoints,
  boundsKey,
  boundsToTuple,
  clampPadding,
  expandBounds,
  resolvePadding,
} from '#/lib/map/bounds'
import { useMapContext } from './map-context'

import type { EdgePadding, LngLat, MapBounds } from '#/lib/map/bounds'
import type { MapLibreMap } from './map-context'

export interface FitBoundsOptions {
  readonly padding?: Partial<EdgePadding>
  /** Never zoom past this, even for a single place. Defaults to 15. */
  readonly maxZoom?: number
  /** Smallest rectangle to fit, in degrees. Stops one place snapping to a doorway. */
  readonly minSpan?: number
  readonly animate?: boolean
}

/** Zoom the ceiling for a fit: close enough to read a street, not a doorway. */
export const FIT_MAX_ZOOM = 15

/**
 * The ceiling when there are no vector tiles under the trip.
 *
 * Outside the published archive the ground is our own generalised coastline, and
 * generalised coastline has nothing to say at city scale: a fit to a walk across
 * Lisbon lands at z12 or better, where the nearest coastline vertex is off-frame
 * *and* the underlay has already faded to nothing — the map is a blank rectangle
 * with pins floating on it. Six keeps the frame inside the range that underlay is
 * drawn over (see `GROUND_MIN_ZOOM`/`GROUND_FADE_MAX_ZOOM`), roughly a 700km
 * window: coarse, but a real shoreline instead of an empty sheet.
 */
export const FIT_MAX_ZOOM_UNMAPPED = 6

/**
 * Eases the camera to a rectangle.
 *
 * Padding is resolved against the *container*, not the viewport, and scaled down
 * when the floating panels would leave nothing to draw in — the 360px-phone case,
 * where a 320px rail and a 48px gutter add up to more than the screen.
 */
export function fitMapToBounds(
  map: MapLibreMap,
  bounds: MapBounds,
  options: FitBoundsOptions = {},
): void {
  const container = map.getContainer()
  const width = container.clientWidth
  const height = container.clientHeight
  // A canvas with no area cannot frame anything, and asking MapLibre to try logs
  // "Map cannot fit within canvas…" and leaves the camera wherever it was. This
  // happens for a frame or two whenever the container is being relaid out — a
  // window resize, a panel that mounts collapsed — so the fit is simply deferred
  // to the `resize` that follows rather than attempted against nothing.
  if (width < 1 || height < 1) return
  // The insets are clamped against the container, so MapLibre has to be looking at
  // the same box. After a viewport resize its transform still holds the previous
  // size for a frame — and a fit computed against the new container but applied to
  // the old transform is how "Map cannot fit within canvas…" gets logged and the
  // camera left where it was. Syncing first costs one measurement when nothing has
  // moved, which is the common case.
  const canvas = map.getCanvas()
  if (canvas.clientWidth !== width || canvas.clientHeight !== height) {
    map.resize()
  }
  const padding = clampPadding(resolvePadding(options.padding), {
    width,
    height,
  })
  const motion = cameraMotion({ duration: MAP_FIT_DURATION })
  const [[west, south], [east, north]] = boundsToTuple(bounds)

  map.fitBounds(
    [
      [west, south],
      [east, north],
    ],
    {
      padding,
      maxZoom: options.maxZoom ?? FIT_MAX_ZOOM,
      animate: options.animate === false ? false : motion.animate,
      duration: motion.duration,
    },
  )
}

export interface FitBoundsProps extends FitBoundsOptions {
  /** Points to frame. Ignored when `bounds` is given. */
  readonly points?: ReadonlyArray<LngLat> | null
  readonly bounds?: MapBounds | null
  /**
   * Change this to re-fit the same rectangle — after a panel opens, say, or when
   * the reader presses a "recentre" button.
   */
  readonly fitKey?: string | number
  /** `false` leaves the camera alone. The reader is driving. */
  readonly enabled?: boolean
}

/**
 * Declarative camera fitting.
 *
 * Renders nothing. It fits when the *value* of the rectangle changes, not when its
 * object identity does, so a parent that rebuilds `points` on every render does
 * not drag the camera back every time the reader pans away from it.
 */
export function FitBounds({
  points = null,
  bounds = null,
  padding,
  maxZoom,
  minSpan,
  animate,
  fitKey,
  enabled = true,
}: FitBoundsProps) {
  const { map, ready } = useMapContext()

  const target = React.useMemo<MapBounds | null>(() => {
    const raw = bounds ?? (points === null ? null : boundsForPoints(points))
    return raw === null ? null : expandBounds(raw, minSpan)
  }, [bounds, minSpan, points])

  // The effect depends on the rectangle's *value* (`key`), never on the object,
  // which is rebuilt whenever the caller's `points` array is.
  const key = boundsKey(target)
  const targetRef = React.useRef(target)
  targetRef.current = target
  const optionsRef = React.useRef({ padding, maxZoom, animate })
  optionsRef.current = { padding, maxZoom, animate }

  React.useEffect(() => {
    const next = targetRef.current
    if (!enabled || map === null || !ready || next === null) return
    fitMapToBounds(map, next, optionsRef.current)
  }, [enabled, fitKey, key, map, ready])

  return null
}
