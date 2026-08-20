import * as React from 'react'
import { LocateFixed, Minus, Navigation, Plus } from 'lucide-react'

import { cn } from '#/lib/cn'
import {
  GlassToolbar,
  IconButton,
  Tooltip,
  TooltipProvider,
  toast,
} from '#/components/ui'
import { cameraMotion } from '#/lib/map/camera'
import { useMapBearing, useMapContext, useMapZoom } from './map-context'
import { useRovingFocus } from './use-roving-focus'

import type { LngLat } from '#/lib/map/bounds'

/** Where a floating control group sits inside the map. */
export type MapCorner =
  'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

/**
 * Width of the control column, in pixels.
 *
 * One `size="sm"` `IconButton` (32px) inside a `padding="xs"` `GlassToolbar` (6px a
 * side). Exported and applied as a width rather than left to the content, because a
 * screen that keeps map clear for this column has to reserve the *same* number in
 * its `fitBounds` padding — and a CSS width that drifts from a camera inset parks
 * pins underneath the geolocate button, which is exactly what it did on a phone.
 */
export const MAP_CONTROLS_WIDTH = 44

/** The width, as a custom property, so one constant drives the rendered column. */
type ColumnVars = React.CSSProperties & Record<'--map-controls-w', string>
const COLUMN: ColumnVars = { '--map-controls-w': `${MAP_CONTROLS_WIDTH}px` }

/**
 * `bottom-right` clears the attribution pill rather than sitting on it — the one
 * place these offsets are not simply the 16px gutter.
 */
const CORNERS: Readonly<Record<MapCorner, string>> = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'right-4 bottom-10',
}

export interface MapControlsProps {
  readonly className?: string
  readonly position?: MapCorner
  readonly showZoom?: boolean
  /** The compass. Rotates with the map and resets north when pressed. */
  readonly showCompass?: boolean
  /** Hidden automatically when the browser has no geolocation. */
  readonly showLocate?: boolean
  /** Zoom the map eases to after a successful locate. */
  readonly locateZoom?: number
  /** Called with the reader's position once it is known. */
  readonly onLocate?: (position: LngLat) => void
  /** Accessible name for the toolbar. */
  readonly label?: string
}

/**
 * Zoom, compass and locate, in our own chrome.
 *
 * MapLibre's `NavigationControl` and `GeolocateControl` bring their own white
 * boxes, their own 29px buttons and their own icons; three details that make a map
 * look bolted on. These are `IconButton`s in the glass variant, so they carry the
 * same hover, focus ring and press as every other control in the product, and they
 * behave as a real toolbar: one tab stop, arrow keys between the buttons.
 *
 * Camera moves go through `cameraMotion()`, so a reader who asked for reduced
 * motion gets the new view immediately instead of a flight.
 *
 * Its own `TooltipProvider` is rendered here rather than assumed from an ancestor,
 * so the map is drop-in on any screen — including one with no app shell, like a
 * shared read-only trip.
 */
export function MapControls({
  className,
  position = 'bottom-right',
  showZoom = true,
  showCompass = true,
  showLocate = true,
  locateZoom = 14,
  onLocate,
  label = 'Map controls',
}: MapControlsProps) {
  const { map } = useMapContext()
  const zoom = useMapZoom(1)
  const bearing = useMapBearing()
  const [locating, setLocating] = React.useState(false)

  // Probed after mount, never during render. Reading `navigator` while rendering
  // makes the server emit a three-button toolbar and the client a four-button
  // one, which React reports as a hydration mismatch and then throws the whole
  // subtree away. Starting `false` means both passes agree, and the locate
  // button appears on the first commit.
  const [hasGeolocation, setHasGeolocation] = React.useState(false)
  React.useEffect(() => {
    setHasGeolocation(
      typeof navigator !== 'undefined' &&
        typeof navigator.geolocation === 'object',
    )
  }, [])
  const withLocate = showLocate && hasGeolocation

  const items =
    (showZoom ? 2 : 0) + (showCompass ? 1 : 0) + (withLocate ? 1 : 0)
  const roving = useRovingFocus({ count: items, orientation: 'vertical' })

  const atMax = map !== null && zoom !== null && zoom >= map.getMaxZoom()
  const atMin = map !== null && zoom !== null && zoom <= map.getMinZoom()

  const zoomBy = (delta: number): void => {
    if (map === null) return
    const motion = cameraMotion({ duration: 260 })
    map.easeTo({ zoom: map.getZoom() + delta, ...motion })
  }

  const resetNorth = (): void => {
    map?.easeTo({ bearing: 0, ...cameraMotion() })
  }

  const locate = (): void => {
    if (map === null || !hasGeolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setLocating(false)
        const target: LngLat = [result.coords.longitude, result.coords.latitude]
        map.easeTo({
          center: [target[0], target[1]],
          zoom: Math.max(map.getZoom(), locateZoom),
          ...cameraMotion({ duration: 700 }),
        })
        onLocate?.(target)
      },
      () => {
        setLocating(false)
        toast.error('We could not get your location.', {
          description:
            'Check that location access is allowed for this site, then try again.',
        })
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    )
  }

  if (items === 0) return null

  // Fixed positions in the roving order, so hiding a group does not leave a gap
  // the arrow keys can land on.
  const zoomInIndex = 0
  const zoomOutIndex = 1
  const compassIndex = showZoom ? 2 : 0
  const locateIndex = compassIndex + (showCompass ? 1 : 0)

  return (
    <TooltipProvider delayDuration={400} skipDelayDuration={200}>
      <GlassToolbar
        label={label}
        orientation="vertical"
        onKeyDown={roving.onKeyDown}
        style={COLUMN}
        className={cn(
          'absolute z-map-overlay w-(--map-controls-w)',
          CORNERS[position],
          className,
        )}
      >
        {showZoom ? (
          <>
            <Tooltip content="Zoom in" side="left">
              <IconButton
                variant="glass"
                size="sm"
                shape="pill"
                label="Zoom in"
                icon={<Plus size={16} strokeWidth={2.5} />}
                className="shadow-none ring-0"
                disabled={atMax}
                onClick={() => zoomBy(1)}
                {...roving.itemProps(zoomInIndex)}
              />
            </Tooltip>
            <Tooltip content="Zoom out" side="left">
              <IconButton
                variant="glass"
                size="sm"
                shape="pill"
                label="Zoom out"
                icon={<Minus size={16} strokeWidth={2.5} />}
                className="shadow-none ring-0"
                disabled={atMin}
                onClick={() => zoomBy(-1)}
                {...roving.itemProps(zoomOutIndex)}
              />
            </Tooltip>
          </>
        ) : null}

        {showCompass ? (
          <Tooltip content="Face north" side="left">
            <IconButton
              variant="glass"
              size="sm"
              shape="pill"
              label="Face north"
              icon={
                <Navigation
                  size={15}
                  strokeWidth={2}
                  className="fill-current"
                  style={{ transform: `rotate(${-bearing}deg)` }}
                />
              }
              className="shadow-none ring-0"
              onClick={resetNorth}
              {...roving.itemProps(compassIndex)}
            />
          </Tooltip>
        ) : null}

        {withLocate ? (
          <Tooltip content="Find my location" side="left">
            <IconButton
              variant="glass"
              size="sm"
              shape="pill"
              label="Find my location"
              icon={<LocateFixed size={15} strokeWidth={2} />}
              className="shadow-none ring-0"
              loading={locating}
              onClick={locate}
              {...roving.itemProps(locateIndex)}
            />
          </Tooltip>
        ) : null}
      </GlassToolbar>
    </TooltipProvider>
  )
}
