import * as React from 'react'

import { countryFeatures, countrySource } from '#/lib/map/countries'
import { mapPalette } from '#/lib/map/palette'
import { FALLBACK_LAYER_IDS, MAP_LAYER_IDS } from '#/lib/map/style'
import { visitRecency } from '#/lib/map/visit-recency'
import { useMapContext } from './map-context'

import type {
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
  GeoJSONSource,
  MapGeoJSONFeature,
  MapMouseEvent,
} from 'maplibre-gl'
import type { CountryFeature } from '#/lib/map/countries'
import type { CountryPalette } from '#/lib/map/palette'
import type { VisitRamp } from '#/lib/map/visit-recency'
import type { MapLibreMap } from './map-context'
import type { MapVisitedCountry } from './types'

/** Source and layer ids, exported so a caller can reason about layer order. */
export const VISITED_COUNTRY_SOURCE_ID = 'atlas-countries'
export const VISITED_COUNTRY_LAYER_IDS = {
  fill: 'atlas-country-fill',
  outline: 'atlas-country-outline',
} as const

/**
 * The feature property the fill expression branches on.
 *
 * Whether a country has been visited is *data*: it belongs in the source, where
 * MapLibre tiles it once and the GPU reads it for free on every frame. Only the
 * two transient states — the country under the pointer, and the country the rest
 * of the screen is currently about — go through `feature-state`.
 */
const VISITED_PROPERTY = 'visited'

/** The recency stop, one of the three `VisitRamp` values. */
const RAMP_PROPERTY = 'ramp'

/**
 * Below this much fill opacity the layer is scenery, not a target.
 *
 * A click has to mean the same thing the reader can see. Once the fade has taken
 * the fill under a fifth of its strength, the country is a tint over the basemap
 * rather than a shape, and treating that as a hit would select a country the
 * reader cannot make out — or, worse, report open water and clear a selection
 * that a list row or a search result put there.
 */
const INTERACTIVE_MIN_OPACITY = 0.2

/** Full strength at and below this zoom. */
const FADE_START_ZOOM = 4

/** Gone, and not drawn at all above it. */
const FADE_END_ZOOM = 6

/**
 * The zoom range this layer speaks in.
 *
 * The bundled outlines are Douglas–Peucker simplified at 0.08°, so a vertex can
 * sit that far from the real coast. A 512px tile spans 360/2^z degrees, which
 * puts that error at about 1.8px at zoom 4 and about 7px at zoom 6 — the point
 * where a reader stops seeing a country and starts seeing a wrong coastline
 * beside the basemap's right one. So the fill fades across exactly that span and
 * both layers carry `maxzoom: fadeEnd`, rather than pretending to a precision
 * the geometry does not have. Everything the atlas has to say is said between
 * the world view and zoom 6; past that the basemap is the better map.
 *
 * `interactiveMax` is where the fade has dropped the fill below
 * {@link INTERACTIVE_MIN_OPACITY} — solved from the ramp rather than guessed, so
 * the two can never drift apart. Exported whole because a caller flying the
 * camera to a country has to land inside this range: framing a small country at
 * zoom 15 would erase the very fill that answered the search.
 */
export const VISITED_COUNTRY_ZOOM = {
  /** Full strength at and below this zoom. */
  fadeStart: FADE_START_ZOOM,
  /** Gone, and not drawn at all above it. */
  fadeEnd: FADE_END_ZOOM,
  /** The last zoom at which a pointer still resolves to a country. */
  interactiveMax:
    FADE_END_ZOOM - INTERACTIVE_MIN_OPACITY * (FADE_END_ZOOM - FADE_START_ZOOM),
} as const

/**
 * Where the fills go, in order of preference, and why each is right.
 *
 * The two basemap styles are not interchangeable, so one anchor cannot serve
 * both. Leaving `before` undefined for the fallback style — the obvious reading
 * of "there are no labels here" — appends the fills to the very top of it and
 * buries the designed no-archive treatment: the coastline hairline and the
 * drafting graticule that are the only cartography that style has.
 *
 * - `pt-label-water` exists only on the vector basemap. Inserting there puts the
 *   fills above ground, sea, land cover and the road silhouette, and below every
 *   label, so a place name stays legible over a country filled solid.
 * - `pt-graticule` exists only on the fallback style. Inserting there puts the
 *   fills above the sea background, the land fill and the coast hairline, and
 *   below the graticule — which is exactly the depth that style's own comment
 *   asks a consumer's fill to take.
 *
 * Both styles draw sea before they draw anything else, so either way a coastal
 * country is measured against water and an inland one against unvisited land:
 * the pairing the contrast figures in `palette.ts` were taken from.
 */
const INSERT_ANCHORS = [
  MAP_LAYER_IDS.labelAnchor,
  FALLBACK_LAYER_IDS.graticule,
] as const

/** Outline weight at the world view and at the point the layer fades out. */
const OUTLINE_WIDTH = {
  rest: { near: 0.5, far: 1 },
  hover: { near: 1.2, far: 2.2 },
  selected: { near: 1.6, far: 3 },
} as const

/** One country as this layer's source carries it. */
interface VisitedCountryFeature {
  readonly type: 'Feature'
  readonly id: string
  readonly geometry: CountryFeature['geometry']
  readonly properties: {
    readonly code: string
    readonly visited: boolean
    /** Only read when `visited` is true; the middle stop otherwise. */
    readonly ramp: VisitRamp
  }
}

/**
 * The payload handed to the source.
 *
 * `features` is a mutable array for the same reason `countryFeatures` uses one:
 * it is the vocabulary MapLibre's own GeoJSON types speak, and declaring it
 * `readonly` would buy a cast at the call site and nothing else.
 */
interface VisitedCountryFeatureCollection {
  readonly type: 'FeatureCollection'
  readonly features: Array<VisitedCountryFeature>
}

/** What a pointer resolved to, which is not the same question as "which code". */
type CountryHit =
  | { readonly kind: 'country'; readonly code: string }
  | { readonly kind: 'water' }
  /** The layer is too faint, or gone, to answer for anything at this zoom. */
  | { readonly kind: 'off-scale' }

export interface VisitedCountriesProps {
  /** The traveller's record. Codes are matched case-insensitively. */
  readonly visits: ReadonlyArray<MapVisitedCountry>
  /**
   * The country the rest of the screen is about, as an ISO alpha-2 code.
   *
   * Controlled: the layer reports what was clicked and paints what it is told,
   * so a search result, a list row and the map all drive one piece of state.
   */
  readonly selectedCode?: string | null
  /**
   * Called with the country under the click, or `null` for open water.
   *
   * Clicking the sea clears the selection, which is the only gesture the map
   * itself offers for "never mind" — deselecting by clicking the selected
   * country again would fight a caller that treats selection as a route param.
   * Not called at all once the layer has faded past
   * {@link VISITED_COUNTRY_ZOOM.interactiveMax}: at street scale the reader is
   * panning a basemap, and silence there is what keeps a selection driven from a
   * list or a search alive.
   */
  readonly onSelect?: (countryCode: string | null) => void
  /** Called as the pointer crosses countries. Never the only way to reach one. */
  readonly onHoverChange?: (countryCode: string | null) => void
}

/**
 * Every country the traveller has been to, filled on the live map.
 *
 * Renders no DOM. The atlas is a data map: one hue from `mapPalette().country`,
 * with lightness carrying how recently each country was last visited, drawn over
 * the whole world so an unvisited country is a *place on the record* rather than
 * a hole in it. Both fills come from the same source and the same expression,
 * which is what keeps the measured visited-against-land and visited-against-water
 * contrast the thing a reader actually sees.
 *
 * Because lightness alone cannot be decoded into a date — adjacent ramp stops sit
 * 1.2–1.3:1 apart — the screen that mounts this owes the reader a legend written
 * from `RECENT_WITHIN_YEARS` and `DISTANT_AFTER_YEARS`, or a per-country label.
 * That is a WCAG 1.4.1 obligation on the host, not something a paint expression
 * can discharge.
 *
 * Seven decisions are worth knowing before changing anything here.
 *
 * **`promoteId` is not optional.** A `geojson` source drops a string feature id
 * during tiling unless the source names the property to promote, and MapLibre
 * coerces what is left through `parseInt` — `'FR'` becomes `NaN` becomes `0`, so
 * all 175 countries collapse onto one id and hovering France lights Afghanistan.
 * The source definition therefore comes from `countrySource()` whole rather than
 * being assembled here. It is frozen and memoised, and MapLibre's `addSource`
 * writes `collectResourceTiming` onto the object it is handed, so it is spread
 * into a fresh object at the call site: passing the frozen one through would
 * throw a `TypeError` under ESM strict mode on a map built with that option.
 *
 * **Hover and selection are `feature-state`, never `setData`.** Re-setting the
 * source data re-tiles 175 MultiPolygons; doing that on `mousemove` would burn a
 * frame budget per pixel of pointer travel. `setFeatureState` touches one feature
 * and repaints, so the state effects below never write data and the data effect
 * never writes state. The payload itself is memoised on the record's own
 * identity, so a parent that rebuilds its array on every render costs nothing.
 *
 * **Insertion depth is per style, and both anchors matter.** See
 * {@link INSERT_ANCHORS}: under the labels on the vector basemap, under the
 * graticule on the fallback style, above the water ground on both.
 *
 * **Every effect keys on the same four values.** `map`, `palette`, `ready` and
 * `styleEpoch` rebuild the source and the layers, and a rebuilt source has no
 * feature state on it. So the selection and interaction effects list exactly the
 * same dependencies: any list that is narrower leaves the highlight painted on a
 * source that no longer exists, and the hover closure holding a stale one.
 *
 * **The style epoch is load-bearing.** A theme switch replaces the style
 * document — `setStyle` diffs our runtime layers out of it and fires
 * `style.load` — which silently drops every runtime-added source, layer *and*
 * feature state. The epoch is the only signal that it happened.
 *
 * **Hover is an enhancement.** `mousemove` does not fire on touch, so hover only
 * ever adds emphasis to something a click, a list row or a search result can
 * already reach. The pointer keeps MapLibre's own grab cursor rather than
 * switching to a pointer over every landmass: the whole map is draggable, and
 * taking that signal away from the entire world to advertise a click is a bad
 * trade.
 *
 * **Hit testing is deduped, and honest about scale.**
 * `queryRenderedFeatures` answers once per tile the feature intersects and once
 * per world copy on screen, so France comes back three or four times at world
 * zoom. The raw array is a list of *renderings*, not a list of countries. Above
 * {@link VISITED_COUNTRY_ZOOM.interactiveMax} it answers for nothing at all.
 */
export function VisitedCountries({
  visits,
  selectedCode = null,
  onSelect,
  onHoverChange,
}: VisitedCountriesProps) {
  const { map, ready, styleEpoch, theme } = useMapContext()
  const palette = mapPalette(theme)

  // The record as a value, so the payload is rebuilt when the traveller's list
  // really changes rather than every time the screen around it re-renders.
  const dataKey = visitKey(visits)
  // Keyed on that string rather than on the array's reference: a caller maps its
  // rows into this shape inline, so the reference is new on every render while
  // the contents change on a trip. The key is a complete serialisation of the
  // two fields the payload reads, so nothing can change behind it, and the array
  // is reached through a ref written in the same render — which keeps the
  // dependency list exactly the value the payload is memoised on, rather than a
  // reference that would rebuild 175 features per keystroke elsewhere on screen.
  const visitsRef = React.useRef(visits)
  visitsRef.current = visits
  const collection = React.useMemo(
    () => visitedCollection(visitsRef.current),
    [dataKey],
  )
  const collectionRef = React.useRef(collection)
  collectionRef.current = collection
  const dataKeyRef = React.useRef(dataKey)
  dataKeyRef.current = dataKey

  /** The record the source is currently carrying, so it is never re-set for free. */
  const appliedKeyRef = React.useRef<string | null>(null)

  const onSelectRef = React.useRef(onSelect)
  onSelectRef.current = onSelect
  const onHoverChangeRef = React.useRef(onHoverChange)
  onHoverChangeRef.current = onHoverChange

  /* -------------------------------------------------------------- layers */

  React.useEffect(() => {
    if (map === null || !ready) return

    if (map.getSource(VISITED_COUNTRY_SOURCE_ID) === undefined) {
      // Spread, never the frozen object itself — see the note above.
      map.addSource(VISITED_COUNTRY_SOURCE_ID, {
        ...countrySource(),
        data: collectionRef.current,
      })
      // The source went in carrying the current record, so the data effect below
      // has nothing to do until that record changes. Without this the layer would
      // re-tile 175 MultiPolygons immediately after adding them, once on mount
      // and again on every theme switch.
      appliedKeyRef.current = dataKeyRef.current
    }

    const before = insertionAnchor(map)

    if (map.getLayer(VISITED_COUNTRY_LAYER_IDS.fill) === undefined) {
      map.addLayer(
        {
          id: VISITED_COUNTRY_LAYER_IDS.fill,
          type: 'fill',
          source: VISITED_COUNTRY_SOURCE_ID,
          maxzoom: VISITED_COUNTRY_ZOOM.fadeEnd,
          paint: {
            'fill-color': fillColour(palette.country),
            // Opaque, so the recorded contrast ratios are the ones on screen.
            'fill-opacity': fade(),
          },
        },
        before,
      )
    }

    if (map.getLayer(VISITED_COUNTRY_LAYER_IDS.outline) === undefined) {
      map.addLayer(
        {
          id: VISITED_COUNTRY_LAYER_IDS.outline,
          type: 'line',
          source: VISITED_COUNTRY_SOURCE_ID,
          maxzoom: VISITED_COUNTRY_ZOOM.fadeEnd,
          layout: { 'line-join': 'round' },
          paint: {
            // `fill-outline-color` is a fixed one-pixel hairline with no width
            // control, so attention needs a line layer of its own.
            'line-color': outlineColour(palette.country),
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              1,
              outlineWidth('near'),
              VISITED_COUNTRY_ZOOM.fadeEnd,
              outlineWidth('far'),
            ],
            'line-opacity': fade(),
          },
        },
        before,
      )
    }

    return () => {
      // A style swap has already removed them, so every step is guarded: cleanup
      // must never throw mid-swap. The source goes last, after the layers that
      // reference it.
      for (const id of [
        VISITED_COUNTRY_LAYER_IDS.outline,
        VISITED_COUNTRY_LAYER_IDS.fill,
      ]) {
        if (map.getLayer(id) !== undefined) map.removeLayer(id)
      }
      if (map.getSource(VISITED_COUNTRY_SOURCE_ID) !== undefined) {
        map.removeSource(VISITED_COUNTRY_SOURCE_ID)
      }
    }
  }, [map, palette, ready, styleEpoch])

  /* ---------------------------------------------------------------- data */

  React.useEffect(() => {
    if (map === null || !ready) return
    if (appliedKeyRef.current === dataKey) return
    const source = map.getSource(VISITED_COUNTRY_SOURCE_ID)
    if (source === undefined) return
    // The narrowest possible cast: MapLibre types `getSource` as the union of
    // every source kind, and only the GeoJSON one carries `setData`.
    ;(source as GeoJSONSource).setData(collectionRef.current)
    appliedKeyRef.current = dataKey
  }, [dataKey, map, palette, ready, styleEpoch])

  /* ----------------------------------------------------------- selection */

  React.useEffect(() => {
    if (map === null || !ready || selectedCode === null) return
    if (map.getSource(VISITED_COUNTRY_SOURCE_ID) === undefined) return

    const id = selectedCode.toUpperCase()
    map.setFeatureState(
      { source: VISITED_COUNTRY_SOURCE_ID, id },
      { selected: true },
    )
    return () => {
      // Written back to `false` rather than removed: a style swap may have taken
      // the source with it, and clearing one flag cannot disturb the other.
      if (map.getSource(VISITED_COUNTRY_SOURCE_ID) === undefined) return
      map.setFeatureState(
        { source: VISITED_COUNTRY_SOURCE_ID, id },
        { selected: false },
      )
    }
  }, [map, palette, ready, selectedCode, styleEpoch])

  /* -------------------------------------------------------- interaction */

  React.useEffect(() => {
    if (map === null || !ready) return

    /** The country currently lit by the pointer, if any. */
    let hovered: string | null = null

    const hitAt = (event: MapMouseEvent): CountryHit => {
      if (map.getLayer(VISITED_COUNTRY_LAYER_IDS.fill) === undefined) {
        return { kind: 'off-scale' }
      }
      if (map.getZoom() > VISITED_COUNTRY_ZOOM.interactiveMax) {
        return { kind: 'off-scale' }
      }
      const found = map.queryRenderedFeatures(event.point, {
        layers: [VISITED_COUNTRY_LAYER_IDS.fill],
      })
      const code = countryCodesAt(found).at(0)
      return code === undefined ? { kind: 'water' } : { kind: 'country', code }
    }

    const setHover = (code: string | null): void => {
      if (code === hovered) return
      if (map.getSource(VISITED_COUNTRY_SOURCE_ID) !== undefined) {
        if (hovered !== null) {
          map.setFeatureState(
            { source: VISITED_COUNTRY_SOURCE_ID, id: hovered },
            { hover: false },
          )
        }
        if (code !== null) {
          map.setFeatureState(
            { source: VISITED_COUNTRY_SOURCE_ID, id: code },
            { hover: true },
          )
        }
      }
      hovered = code
      onHoverChangeRef.current?.(code)
    }

    const onMove = (event: MapMouseEvent): void => {
      const hit = hitAt(event)
      setHover(hit.kind === 'country' ? hit.code : null)
    }
    const onOut = (): void => {
      setHover(null)
    }
    const onClick = (event: MapMouseEvent): void => {
      const hit = hitAt(event)
      // Silence, not `null`: past the fade this gesture is a pan on the basemap
      // and says nothing about the record, so clearing a selection the caller
      // drove from a list row or a search result would be us inventing intent.
      if (hit.kind === 'off-scale') return
      onSelectRef.current?.(hit.kind === 'country' ? hit.code : null)
    }

    map.on('mousemove', onMove)
    map.on('mouseout', onOut)
    // A tap leaves the last hovered country lit, because nothing takes the
    // pointer away again. Clearing on the next touch keeps the emphasis honest
    // without pretending a finger hovers.
    map.on('touchstart', onOut)
    map.on('click', onClick)

    return () => {
      setHover(null)
      map.off('mousemove', onMove)
      map.off('mouseout', onOut)
      map.off('touchstart', onOut)
      map.off('click', onClick)
    }
  }, [map, palette, ready, styleEpoch])

  return null
}

/* ------------------------------------------------------------------ layers */

/**
 * The deepest anchor this style actually has, or `undefined` if it has neither.
 *
 * A style that answers for no anchor at all is one neither of ours produced — a
 * caller's own style document — and appending on top is the only defensible
 * guess there.
 */
function insertionAnchor(map: Pick<MapLibreMap, 'getLayer'>): string | undefined {
  for (const id of INSERT_ANCHORS) {
    if (map.getLayer(id) !== undefined) return id
  }
  return undefined
}

/* ------------------------------------------------------------------ paint */

/** The fade both layers share, so they can never hand over at different zooms. */
function fade(): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    VISITED_COUNTRY_ZOOM.fadeStart,
    1,
    VISITED_COUNTRY_ZOOM.fadeEnd,
    0,
  ]
}

/**
 * The fill, as one expression over data and state.
 *
 * Order is the priority the reader expects: the country the screen is about wins
 * over the country under the pointer, which wins over the record itself. Every
 * colour comes from the `country` group of the palette, which mirrors the
 * `--color-country-*` tokens value for value; nothing here is a literal.
 */
function fillColour(
  country: CountryPalette,
): DataDrivenPropertyValueSpecification<string> {
  return [
    'case',
    ['boolean', ['get', VISITED_PROPERTY], false],
    [
      'case',
      ['boolean', ['feature-state', 'selected'], false],
      country.visitedSelected,
      ['boolean', ['feature-state', 'hover'], false],
      country.visitedHover,
      [
        'match',
        ['get', RAMP_PROPERTY],
        'visitedRecent',
        country.visitedRecent,
        'visitedDistant',
        country.visitedDistant,
        country.visited,
      ],
    ],
    [
      'case',
      [
        'any',
        ['boolean', ['feature-state', 'selected'], false],
        ['boolean', ['feature-state', 'hover'], false],
      ],
      // Unvisited land has one attention colour, not two: the palette calls it
      // the "you could mark this" wash, and weight carries the rest.
      country.landHover,
      country.land,
    ],
  ]
}

/** The hairline: a knockout around a visited country, a border everywhere else. */
function outlineColour(
  country: CountryPalette,
): DataDrivenPropertyValueSpecification<string> {
  return [
    'case',
    ['boolean', ['get', VISITED_PROPERTY], false],
    country.visitedEdge,
    country.landEdge,
  ]
}

/**
 * Outline weight for one end of the zoom ramp.
 *
 * Zoom has to stay at the top of the expression — the style spec only allows it
 * as the input of an outer `interpolate` — so the state branch is evaluated at
 * each stop rather than wrapping the interpolation.
 */
function outlineWidth(end: 'near' | 'far'): ExpressionSpecification {
  return [
    'case',
    ['boolean', ['feature-state', 'selected'], false],
    OUTLINE_WIDTH.selected[end],
    ['boolean', ['feature-state', 'hover'], false],
    OUTLINE_WIDTH.hover[end],
    OUTLINE_WIDTH.rest[end],
  ]
}

/* ------------------------------------------------------------------- data */

/** The record as one comparable value: every field the payload reads, in order. */
function visitKey(visits: ReadonlyArray<MapVisitedCountry>): string {
  return visits
    .map((visit) => `${visit.countryCode}:${visit.lastVisitedOn ?? ''}`)
    .join('|')
}

/**
 * The bundled world, with the traveller's record folded into its properties.
 *
 * The geometry arrays are handed straight through by reference: they are frozen
 * and shared with the ground underlay, so this view costs 175 small objects
 * rather than a second copy of 8,937 coordinate pairs.
 */
function visitedCollection(
  visits: ReadonlyArray<MapVisitedCountry>,
): VisitedCountryFeatureCollection {
  const now = new Date()
  const ramps = new Map<string, VisitRamp>()
  for (const visit of visits) {
    ramps.set(
      visit.countryCode.toUpperCase(),
      visitRecency(visit.lastVisitedOn, now),
    )
  }

  return {
    type: 'FeatureCollection',
    features: countryFeatures().features.map((feature) => {
      const ramp = ramps.get(feature.properties.code)
      return {
        type: 'Feature',
        id: feature.id,
        geometry: feature.geometry,
        properties: {
          code: feature.properties.code,
          visited: ramp !== undefined,
          ramp: ramp ?? 'visited',
        },
      }
    }),
  }
}

/**
 * The distinct countries under a hit test, topmost first.
 *
 * `queryRenderedFeatures` returns one entry per tile a feature intersects and
 * one per world copy on screen, so a single country answers three or four times
 * at atlas zoom. Anything that counts, iterates or toggles the raw array is
 * counting renderings rather than countries. Order is preserved because it is
 * the tie-break: MapLibre answers topmost first, so two countries whose
 * simplified outlines overlap resolve to the one drawn last.
 */
function countryCodesAt(
  features: ReadonlyArray<MapGeoJSONFeature>,
): Array<string> {
  const codes: Array<string> = []
  const seen = new Set<string>()
  for (const feature of features) {
    const id = feature.id
    if (typeof id !== 'string' || seen.has(id)) continue
    seen.add(id)
    codes.push(id)
  }
  return codes
}
