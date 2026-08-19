import * as React from 'react'

import { mapPalette } from '#/lib/map/palette'
import { EMPTY_ROUTES, routeCollection } from '#/lib/map/routes'
import { MAP_LAYER_IDS } from '#/lib/map/style'
import { useMapContext } from './map-context'

import type {
  DataDrivenPropertyValueSpecification,
  GeoJSONSource,
} from 'maplibre-gl'
import type { RouteDay } from '#/lib/map/routes'

/** Source and layer ids, exported so a caller can reason about layer order. */
export const ROUTE_SOURCE_ID = 'trip-routes'
export const ROUTE_LAYER_IDS = {
  casing: 'trip-route-casing',
  line: 'trip-route-line',
} as const

/** How far a day drops back when another day is the one being read. */
const DIMMED = 0.26

const CASING_OPACITY = 0.5
const LINE_OPACITY = 0.9

export interface DayRoutesProps {
  /** One entry per day, stops already in visiting order. */
  readonly days: ReadonlyArray<RouteDay>
  /**
   * Day to draw at full strength. Every other day drops back, so selecting a day
   * in the rail reads on the map as *this* day rather than as one line among ten.
   * `null` draws them all evenly.
   */
  readonly activeDay?: number | null
  /** `false` clears the lines without unmounting the component. */
  readonly visible?: boolean
}

/**
 * The walking order of each day, drawn on the map.
 *
 * Renders no DOM. MapLibre draws lines far better than absolutely-positioned
 * elements can: a GeoJSON line layer stays pin-sharp through every zoom step and
 * moves with the world for free, where an SVG overlay would have to be
 * re-projected on every frame of every pan.
 *
 * Three details earn their keep. The line goes in *below* the label anchor, so a
 * place name is never buried under a route. It is drawn as a casing plus a dashed
 * core, the casing in the map's own ground colour, which is what keeps a route
 * legible as it crosses a park, a river and a motorway inside one block. And it is
 * dashed rather than solid because these are straight lines between stops — we
 * have no routing engine, and a solid line would claim we know which street it
 * takes.
 *
 * The style epoch in the dependency lists is load-bearing: a theme switch replaces
 * the whole style document, which silently drops every runtime-added source, so
 * without re-adding on that signal the routes would vanish the first time a reader
 * toggled dark mode.
 */
export function DayRoutes({
  days,
  activeDay = null,
  visible = true,
}: DayRoutesProps) {
  const { map, ready, styleEpoch, theme } = useMapContext()
  const palette = mapPalette(theme)

  const collection = visible ? routeCollection(days) : EMPTY_ROUTES

  // The geometry as a value, so the data effect fires when the itinerary really
  // changes rather than every time the planner re-renders its arrays.
  const dataKey = JSON.stringify(collection)
  const collectionRef = React.useRef(collection)
  collectionRef.current = collection

  /* -------------------------------------------------------------- layers */

  React.useEffect(() => {
    if (map === null || !ready) return

    if (map.getSource(ROUTE_SOURCE_ID) === undefined) {
      map.addSource(ROUTE_SOURCE_ID, {
        type: 'geojson',
        data: collectionRef.current,
      })
    }

    // A style with the label anchor is the vector basemap; on the fallback style
    // there is nothing to insert before and the routes simply go on top.
    const before =
      map.getLayer(MAP_LAYER_IDS.labelAnchor) === undefined
        ? undefined
        : MAP_LAYER_IDS.labelAnchor

    if (map.getLayer(ROUTE_LAYER_IDS.casing) === undefined) {
      map.addLayer(
        {
          id: ROUTE_LAYER_IDS.casing,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': palette.route.casing,
            'line-width': ['interpolate', ['linear'], ['zoom'], 8, 5, 14, 9],
            'line-opacity': CASING_OPACITY,
          },
        },
        before,
      )
    }

    if (map.getLayer(ROUTE_LAYER_IDS.line) === undefined) {
      map.addLayer(
        {
          id: ROUTE_LAYER_IDS.line,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': palette.route.line,
            'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.8, 14, 3],
            'line-dasharray': [2.4, 1.8],
            'line-opacity': LINE_OPACITY,
          },
        },
        before,
      )
    }

    return () => {
      // A style swap has already removed them, so every step is guarded: cleanup
      // must never throw mid-swap. The source goes last, after the layers that
      // reference it.
      for (const id of [ROUTE_LAYER_IDS.line, ROUTE_LAYER_IDS.casing]) {
        if (map.getLayer(id) !== undefined) map.removeLayer(id)
      }
      if (map.getSource(ROUTE_SOURCE_ID) !== undefined) {
        map.removeSource(ROUTE_SOURCE_ID)
      }
    }
    // `palette` is one of two stable module-level objects, so a theme switch —
    // which also bumps `styleEpoch` — rebuilds the layers in the new colours, and
    // nothing else re-runs this.
  }, [map, palette, ready, styleEpoch])

  /* ---------------------------------------------------------------- data */

  React.useEffect(() => {
    if (map === null || !ready) return
    const source = map.getSource(ROUTE_SOURCE_ID)
    if (source === undefined) return
    // The narrowest possible cast: MapLibre types `getSource` as the union of
    // every source kind, and only the GeoJSON one carries `setData`.
    ;(source as GeoJSONSource).setData(collectionRef.current)
  }, [dataKey, map, ready, styleEpoch])

  /* ------------------------------------------------------------ emphasis */

  React.useEffect(() => {
    if (map === null || !ready) return
    if (map.getLayer(ROUTE_LAYER_IDS.line) === undefined) return

    const emphasis = (
      full: number,
    ): DataDrivenPropertyValueSpecification<number> =>
      activeDay === null
        ? full
        : ['case', ['==', ['get', 'day'], activeDay], full, full * DIMMED]

    map.setPaintProperty(
      ROUTE_LAYER_IDS.casing,
      'line-opacity',
      emphasis(CASING_OPACITY),
    )
    map.setPaintProperty(
      ROUTE_LAYER_IDS.line,
      'line-opacity',
      emphasis(LINE_OPACITY),
    )
  }, [activeDay, map, ready, styleEpoch])

  return null
}
