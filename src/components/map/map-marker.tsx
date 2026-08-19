import * as React from 'react'
import { createPortal } from 'react-dom'

import { cn } from '#/lib/cn'
import { useMapContext } from './map-context'

import type { Marker, PositionAnchor } from 'maplibre-gl'

export interface MapMarkerProps {
  readonly lng: number
  readonly lat: number
  /** Which part of the marker sits on the coordinate. Defaults to its centre. */
  readonly anchor?: PositionAnchor
  /** Pixel nudge from the anchor point. */
  readonly offset?: readonly [number, number]
  /** Paints above sibling markers — a selected pin, or one showing its card. */
  readonly elevated?: boolean
  readonly className?: string
  readonly children: React.ReactNode
}

/**
 * Positions React content at a coordinate.
 *
 * MapLibre owns the marker pane and rewrites a `transform` on every frame of
 * every pan, so the element itself has to be MapLibre's. This component creates
 * that element once, hands it to a `Marker`, and renders its children into it
 * through a portal — which means a pin can be an `<img>`, a `<button>` and a
 * hover card, and can still hold React state, while MapLibre keeps doing the one
 * thing it is better at.
 *
 * Renders nothing on the server and nothing before the map exists.
 */
export function MapMarker({
  lng,
  lat,
  anchor = 'center',
  offset,
  elevated = false,
  className,
  children,
}: MapMarkerProps) {
  const { map, gl } = useMapContext()

  // Lazily created once per component instance, and never on the server.
  const [element] = React.useState<HTMLDivElement | null>(() =>
    typeof document === 'undefined' ? null : document.createElement('div'),
  )

  const markerRef = React.useRef<Marker | null>(null)

  // Held in refs, not in the effect's dependency list: a place that moves — a
  // dragged pin, a corrected geocode — must update its marker in place rather
  // than tear it down and build a new one, which would flash and lose hover.
  const positionRef = React.useRef<[number, number]>([lng, lat])
  positionRef.current = [lng, lat]

  const offsetRef = React.useRef(offset)
  offsetRef.current = offset

  // Serialised, so a fresh array literal from the caller does not re-create the
  // marker on every render.
  const offsetKey = offset === undefined ? '' : `${offset[0]},${offset[1]}`

  React.useEffect(() => {
    if (map === null || gl === null || element === null) return

    const currentOffset = offsetRef.current
    const marker = new gl.Marker({
      element,
      anchor,
      offset:
        currentOffset === undefined
          ? undefined
          : [currentOffset[0], currentOffset[1]],
      // Our pins are visual, not handles; dragging one would silently move a
      // place the reader only meant to inspect.
      draggable: false,
    })
      .setLngLat(positionRef.current)
      .addTo(map)

    markerRef.current = marker

    return () => {
      markerRef.current = null
      marker.remove()
    }
  }, [map, gl, element, anchor, offsetKey])

  React.useEffect(() => {
    markerRef.current?.setLngLat([lng, lat])
  }, [lng, lat])

  React.useEffect(() => {
    if (element === null) return

    // Added, never assigned.
    //
    // MapLibre puts `maplibregl-marker` on this element itself, and its
    // stylesheet is what makes the marker `position: absolute; top: 0; left: 0`.
    // Assigning `className` wholesale dropped that class, which left the element
    // in static flow as a full-width block — so the `translate(-50%, -50%)` in
    // MapLibre's own transform resolved against the *container's* width and every
    // pin landed half a viewport to the left of its coordinate. Touching only our
    // own classes leaves MapLibre's intact and keeps stacking order ours.
    const own = cn(elevated && 'z-10', className)
      .split(' ')
      .filter((token) => token !== '')
    if (own.length === 0) return

    element.classList.add(...own)
    return () => element.classList.remove(...own)
  }, [element, elevated, className])

  if (element === null) return null
  return createPortal(children, element)
}
