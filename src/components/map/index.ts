/**
 * The map surface.
 *
 * Everything a screen needs to put a map on the page, in the order it is usually
 * reached for:
 *
 * ```tsx
 * <MapCanvas label="Trip map" bounds={tripBounds} padding={{ left: 360, right: 380 }}>
 *   <CategoryFilterBar categories={categories} selected={active} onChange={setActive} />
 *   <PlaceMarkers places={places} categories={categories} selectedId={selected} onSelect={open} />
 *   <FitBounds points={points} padding={{ left: 360, right: 380 }} />
 *   <MapControls />
 *   <MapLegend categories={categories} counts={counts} />
 * </MapCanvas>
 * ```
 *
 * `MapCanvas` owns the MapLibre instance and publishes it on a context; every
 * other component in here reads that context, so they compose in any order and
 * none of them needs the map passed down as a prop. Anything drawn on the map
 * itself — pins, cards — goes through `MapMarker`, which portals React into
 * MapLibre's own marker pane so it pans and zooms with the world.
 *
 * The pure logic behind all of it (style generation, `pmtiles://`, bounds maths,
 * clustering, camera policy) lives in `src/lib/map` and is re-exported here so a
 * consumer has one import to remember.
 */

/* --------------------------------------------------------------------- canvas */
export { MapCanvas, MAP_MIN_ZOOM, MAP_MAX_ZOOM } from './map-canvas'
export type { MapCanvasProps } from './map-canvas'

/* -------------------------------------------------------------------- context */
export {
  MapProvider,
  useMapContext,
  useMapInstance,
  useMapListener,
  useMapZoom,
  useMapBearing,
  useMapCamera,
} from './map-context'
export type {
  BasemapStatus,
  MapCamera,
  MapContextValue,
  MapEventName,
  MapLibreMap,
  MapLibreModule,
} from './map-context'

/* -------------------------------------------------------------------- markers */
export { MapMarker } from './map-marker'
export type { MapMarkerProps } from './map-marker'
export { ClusterPin, DayPin, PlacePin } from './pins'
export type {
  ClusterPinProps,
  DayPinProps,
  PinSize,
  PlacePinProps,
} from './pins'
export { MarkerPopover, markerLabel } from './marker-popover'
export type { MarkerPopoverProps } from './marker-popover'
export { ClusterMarker, PlaceMarker, PlaceMarkers } from './place-marker'
export type {
  ClusterMarkerProps,
  PlaceMarkerProps,
  PlaceMarkersProps,
} from './place-marker'

/* ----------------------------------------------------------------- map chrome */
export { MAP_CONTROLS_WIDTH, MapControls } from './map-controls'
export type { MapControlsProps, MapCorner } from './map-controls'
export { CategoryFilterBar } from './category-filter-bar'
export type { CategoryFilterBarProps } from './category-filter-bar'
export { MapLegend } from './map-legend'
export type { MapLegendProps } from './map-legend'
export { MapAttribution } from './map-attribution'
export type { MapAttributionProps } from './map-attribution'
export { BasemapNotice } from './basemap-notice'
export type { BasemapNoticeProps } from './basemap-notice'
export { CoverageNotice } from './coverage-notice'
export type { CoverageNoticeProps } from './coverage-notice'

/* ---------------------------------------------------------------- overlays */
export { DayRoutes, ROUTE_LAYER_IDS, ROUTE_SOURCE_ID } from './day-routes'
export type { DayRoutesProps } from './day-routes'
/**
 * `VisitedCountries` draws the bundled 1:110m outlines on its first frame and
 * upgrades itself to the 1:50m cut — `loadCountryDetail()` from `#/lib/map` —
 * as soon as that asset arrives. Two answers a screen may already have rendered
 * move with it: `hasCountryOutline()` starts saying yes to Singapore, Malta and
 * the Maldives, and `countryBounds()` grows to hold a country's offshore
 * territories.
 *
 * `useCountryDetail()` is how anything outside the map is told. Read it in the
 * component that renders either answer and put it in the dependency list of the
 * memo that resolves them — a memo keyed on the record alone resolves once
 * against the bundled cut and then contradicts the map for the life of the
 * screen. It is a subscription over process-wide state, so mounting it beside
 * the map costs no second request.
 *
 * One of those two answers changes meaning as well as value. A `countryBounds()`
 * rectangle grown to hold Guadeloupe and Réunion describes France honestly and
 * frames it uselessly: fitting a camera to it lands on open ocean. Use it to ask
 * whether a code can be drawn and how much of the world it covers; frame a
 * fly-to on the country's principal landmass instead.
 */
export {
  useCountryDetail,
  VisitedCountries,
  VISITED_COUNTRY_LAYER_IDS,
  VISITED_COUNTRY_SOURCE_ID,
  VISITED_COUNTRY_ZOOM,
} from './visited-countries'
export type { VisitedCountriesProps } from './visited-countries'

/* ------------------------------------------------------------------- behaviour */
export {
  FitBounds,
  fitMapToBounds,
  FIT_MAX_ZOOM,
  FIT_MAX_ZOOM_UNMAPPED,
} from './fit-bounds'
export type { FitBoundsOptions, FitBoundsProps } from './fit-bounds'
export { useArchiveCoverage } from './use-coverage'
export { useRovingFocus } from './use-roving-focus'
export type {
  RovingFocus,
  RovingFocusOptions,
  RovingItemProps,
} from './use-roving-focus'

/* ----------------------------------------------------------------- data shapes */
export { CategoryIcon, categoryIcon } from './category-icon'
export type { CategoryIconProps } from './category-icon'
export type { MapCategory, MapPlace, MapVisitedCountry } from './types'

/* ------------------------------------------------------------------ map logic */
export * from '#/lib/map'
