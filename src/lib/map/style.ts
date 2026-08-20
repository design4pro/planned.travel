/**
 * The basemap style sheets.
 *
 * Two complete MapLibre styles — light and dark — generated from
 * {@link MAP_PALETTES}, which mirrors `src/styles/tokens.css`. Nothing here is a
 * generic OSM look: land is the same warm paper the cards sit on, water is a
 * desaturated pull from the brand pine, the road network is a casing/fill
 * silhouette rather than six competing hues, and every label is set in the UI
 * font at an ink tier the rest of the product already uses.
 *
 * The vector source is a Protomaps `.pmtiles` archive served by our own
 * `/api/tiles` route out of R2. Tile URLs are built by
 * `src/routes/api/tiles/-client.ts`, so the route prefix is stated exactly once.
 *
 * **Labels are rasterised locally, on purpose.** The style declares no `glyphs`
 * URL. MapLibre reads that as "there is no glyph server" and rasterises every
 * codepoint itself with TinySDF, using the `text-font` stack straight as a CSS
 * font family — so the type on the map is the very same Geist the rest of the
 * product is set in, at the weight the layer asks for, with no SDF pack to build
 * or ship. Declaring a `glyphs` template we cannot serve is strictly worse: it
 * costs a failed request per range, floods the console with one
 * "Rendering codepoint … locally instead" warning per character, and then falls
 * back to this exact path anyway. `tileEndpoints().glyphs` still exists for the
 * day a real pack lands in R2; wiring it back is one line.
 *
 * No sprite is declared either, because the cartography is deliberately
 * label-only: no icon sheet to publish, and one fewer request per map load.
 */

import { tileEndpoints } from '#/routes/api/tiles/-client'
import { worldLandFeatures } from './countries'
import { graticule } from './graticule'
import { mapPalette } from './palette'

import type { MapOptions } from 'maplibre-gl'
import type { ResolvedTheme } from '#/lib/theme'
import type { GraticuleOptions } from './graticule'
import type { MapPalette } from './palette'

/** A full MapLibre style document, taken from MapLibre's own option type. */
export type MapStyle = Exclude<NonNullable<MapOptions['style']>, string>

type MapLayer = MapStyle['layers'][number]

/**
 * MapLibre does not re-export the style-spec vocabulary, so the two types the
 * builders below need are recovered from the shapes it does export:
 * `ExpressionSpecification` is recovered as the set of array-shaped values a
 * data-driven property accepts. That one type covers both jobs here, because a
 * layer `filter` is itself an expression that evaluates to a boolean.
 */
type MapExpression = Extract<
  NonNullable<
    NonNullable<Extract<MapLayer, { type: 'symbol' }>['layout']>['text-field']
  >,
  Array<unknown>
>

/** Source id of the Protomaps archive, for callers adding their own layers. */
export const BASEMAP_SOURCE_ID = 'basemap'

/** Source id of the generated graticule used by the no-archive style. */
export const GRATICULE_SOURCE_ID = 'graticule'

/**
 * Source id of our own generalised coastlines.
 *
 * Shared by both honest-degradation paths: the ground underlay beneath a
 * regional archive, and the no-archive style, which draws the whole world from
 * it. The payload is {@link worldLandFeatures}, memoised and frozen in
 * `./countries` so the per-country view and this one hold the *same* ring arrays
 * rather than two copies of them.
 */
export const WORLD_LAND_SOURCE_ID = 'world-land'

/**
 * Zoom range over which the ground underlay hands over.
 *
 * Our bundled coastlines are generalised to about nine kilometres. Across a
 * region that is a fraction of a pixel and the land/water ground is the most
 * useful thing on the screen; across a city it would put a pin in the sea. So
 * the underlay is drawn at regional scale and has faded out entirely by the time
 * the reader is looking at streets, leaving the warm ground it started from.
 */
export const GROUND_MIN_ZOOM = 5
export const GROUND_FADE_MAX_ZOOM = 9

/**
 * Where the graticule stops being drafting lines and starts being graph paper.
 *
 * The grid is generated at one fixed step, so its *density on screen* is decided
 * entirely by the camera: the step that gives a trip-sized frame half a dozen
 * useful reference lines gives a whole-world frame — the frame an empty trip opens
 * on — a line every few pixels. Rather than regenerate the source per zoom, the
 * grid simply gets quieter the further out the reader is, which is also the zoom
 * at which the coastlines it was standing in for are fully drawn anyway.
 */
export const GRATICULE_WORLD_ZOOM = 2
export const GRATICULE_WORLD_OPACITY = 0.22

/**
 * Font stacks, in MapLibre's `text-font` form.
 *
 * `Geist` is the product's UI face, so map labels and panel labels are set in
 * the same voice. `Noto Sans Regular` follows it in every stack to cover the
 * scripts Geist does not — a Tokyo trip has to render Tokyo's own name.
 */
export const MAP_FONT_REGULAR: ReadonlyArray<string> = [
  'Geist Regular',
  'Noto Sans Regular',
]
export const MAP_FONT_MEDIUM: ReadonlyArray<string> = [
  'Geist Medium',
  'Noto Sans Regular',
]
export const MAP_FONT_SEMIBOLD: ReadonlyArray<string> = [
  'Geist SemiBold',
  'Noto Sans Regular',
]

/**
 * Attribution for the underlying data. Rendered by `MapAttribution` in our own
 * chrome rather than by MapLibre's control, and also attached to the source so
 * the style document is self-describing.
 */
export const MAP_ATTRIBUTION: ReadonlyArray<{
  readonly label: string
  readonly href: string
}> = [
  { label: 'OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' },
  { label: 'Protomaps', href: 'https://protomaps.com' },
]

const ATTRIBUTION_HTML = MAP_ATTRIBUTION.map(
  (entry) =>
    `<a href="${entry.href}" target="_blank" rel="noreferrer">${entry.label}</a>`,
).join(' · ')

/**
 * Well-known layer ids, so a consumer can insert its own layers at the right
 * depth — a route line belongs above the roads and below the labels.
 */
export const MAP_LAYER_IDS = {
  background: 'pt-background',
  earth: 'pt-earth',
  water: 'pt-water',
  buildings: 'pt-buildings',
  roads: 'pt-road-major',
  /** Insert overlays (routes, corridors, heat) *before* this id to sit under labels. */
  labelAnchor: 'pt-label-water',
  localityLabels: 'pt-label-locality',
} as const

/**
 * Layer ids of the no-archive style, in draw order.
 *
 * Named separately from {@link MAP_LAYER_IDS} because the two styles are not
 * interchangeable: this one has no `source-layer` anywhere, no symbol layer, and
 * no `pt-label-water` to insert beneath. A consumer that adds its own fill wants
 * it above {@link FALLBACK_LAYER_IDS.coast} and below the graticule.
 */
export const FALLBACK_LAYER_IDS = {
  /** The sea, as a background layer — everything else is drawn on top of it. */
  background: MAP_LAYER_IDS.background,
  land: 'pt-land',
  coast: 'pt-coast',
  graticule: 'pt-graticule',
  graticuleMajor: 'pt-graticule-major',
} as const

export interface BasemapStyleOptions {
  readonly theme: ResolvedTheme
  /**
   * Absolute origin to prefix tile URLs with. Only needed away from a document
   * base (SSR head links); omit it in the browser to stay same-origin.
   */
  readonly origin?: string
  /**
   * Object key of a specific archive, e.g. `basemaps/planet-2026-08.pmtiles`.
   * Defaults to the mutable alias so rotating `TILES_ARCHIVE_KEY` swaps the
   * basemap for every client at once.
   */
  readonly archive?: string
  /** Building footprints. On for the trip planner, off for the world atlas. */
  readonly buildings?: boolean
  /** Point-of-interest labels. Off by default: our own pins are the POIs. */
  readonly poiLabels?: boolean
  /** Road name labels. On by default from z13. */
  readonly roadLabels?: boolean
  /**
   * Draws our own sea, coastlines and graticule beneath the vector layers, so an
   * area the archive was not cut to still reads as a map instead of as a blank
   * rectangle. Costs ~25KB of bundled geometry, so it is opt-in: switch it on for
   * a regional archive and leave it off for a planet build, where it could never
   * be seen. Default `false`.
   */
  readonly ground?: boolean
  /** Shape of the ground graticule. Only read when `ground` is on. */
  readonly graticule?: GraticuleOptions
}

export interface FallbackStyleOptions {
  readonly theme: ResolvedTheme
  /** Graticule shape. Defaults to a 15° grid with every 60° emphasised. */
  readonly graticule?: GraticuleOptions
}

/* -------------------------------------------------------------------------------------------------
 * Expression helpers
 * ---------------------------------------------------------------------------------------------- */

/** `true` when the feature's `kind` is one of `kinds`. */
function kindIn(kinds: ReadonlyArray<string>): MapExpression {
  return ['match', ['get', 'kind'], [...kinds], true, false]
}

/** `true` when the feature carries a non-empty `name`. */
function hasName(): MapExpression {
  return ['all', ['has', 'name'], ['!=', ['get', 'name'], '']]
}

/**
 * Label text.
 *
 * `name:en` first so an English-language product reads the Latin name where the
 * tiles carry one, falling back to the archive's default name where they do not.
 * Built fresh per call: a shared literal would have to be readonly, and MapLibre
 * types its style properties as mutable.
 */
function labelText(): MapExpression {
  return ['coalesce', ['get', 'name:en'], ['get', 'name']]
}

/* -------------------------------------------------------------------------------------------------
 * Layer builders
 * ---------------------------------------------------------------------------------------------- */

interface RoadTier {
  readonly id: string
  readonly kinds: ReadonlyArray<string>
  readonly fill: string
  readonly casing: string
  readonly minzoom: number
  /** `[zoom, width]` stops for the fill; the casing adds `casingGrowth` on top. */
  readonly widths: ReadonlyArray<readonly [number, number]>
}

/**
 * A road tier as a casing/fill pair.
 *
 * Drawing the casing of *every* tier before any fill would be more correct at
 * junctions, but it doubles the layer count and, at the widths this cartography
 * uses, is invisible. Tiers are emitted casing-then-fill, cheapest tier first.
 */
function roadTier(tier: RoadTier, casingGrowth: number): Array<MapLayer> {
  return [
    {
      id: `${tier.id}-casing`,
      type: 'line',
      source: BASEMAP_SOURCE_ID,
      'source-layer': 'roads',
      minzoom: tier.minzoom,
      filter: kindIn(tier.kinds),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': tier.casing,
        'line-width': interpolateWidth(tier.widths, casingGrowth),
      },
    },
    {
      id: tier.id,
      type: 'line',
      source: BASEMAP_SOURCE_ID,
      'source-layer': 'roads',
      minzoom: tier.minzoom,
      filter: kindIn(tier.kinds),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': tier.fill,
        'line-width': interpolateWidth(tier.widths, 0),
      },
    },
  ]
}

/** An exponential zoom ramp for a line width, widened by `extra` pixels. */
function interpolateWidth(
  stops: ReadonlyArray<readonly [number, number]>,
  extra: number,
): ['interpolate', ['exponential', number], ['zoom'], ...Array<number>] {
  const flat: Array<number> = []
  for (const [zoom, width] of stops) {
    flat.push(zoom, width <= 0 ? 0 : width + extra)
  }
  return ['interpolate', ['exponential', 1.55], ['zoom'], ...flat]
}

function landLayers(
  palette: MapPalette,
  options: { readonly background?: boolean } = {},
): Array<MapLayer> {
  const background: Array<MapLayer> =
    options.background === false
      ? []
      : [
          {
            id: MAP_LAYER_IDS.background,
            type: 'background',
            paint: { 'background-color': palette.background },
          },
        ]
  return [
    ...background,
    {
      id: MAP_LAYER_IDS.earth,
      type: 'fill',
      source: BASEMAP_SOURCE_ID,
      'source-layer': 'earth',
      paint: { 'fill-color': palette.earth },
    },
    {
      id: 'pt-landcover',
      type: 'fill',
      source: BASEMAP_SOURCE_ID,
      'source-layer': 'landcover',
      paint: {
        'fill-color': [
          'match',
          ['get', 'kind'],
          'forest',
          palette.landcover.forest,
          'grassland',
          palette.landcover.grass,
          'scrub',
          palette.landcover.scrub,
          'barren',
          palette.landcover.sand,
          'glacier',
          palette.landcover.glacier,
          'farmland',
          palette.landcover.farmland,
          'urban_area',
          palette.landcover.urban,
          palette.earth,
        ],
        // Landcover is texture, not information: it fades in as the reader
        // zooms past the continental view and never competes with the pins.
        'fill-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3,
          0,
          5,
          0.7,
          12,
          0.45,
        ],
        'fill-antialias': false,
      },
    },
    {
      id: 'pt-natural',
      type: 'fill',
      source: BASEMAP_SOURCE_ID,
      'source-layer': 'natural',
      minzoom: 6,
      paint: {
        'fill-color': [
          'match',
          ['get', 'kind'],
          ['wood', 'forest'],
          palette.landcover.forest,
          ['grass', 'grassland', 'meadow'],
          palette.landcover.grass,
          ['scrub', 'heath'],
          palette.landcover.scrub,
          ['sand', 'beach'],
          palette.landcover.sand,
          'glacier',
          palette.landcover.glacier,
          palette.landcover.grass,
        ],
        'fill-opacity': 0.55,
      },
    },
    {
      id: 'pt-landuse',
      type: 'fill',
      source: BASEMAP_SOURCE_ID,
      'source-layer': 'landuse',
      minzoom: 8,
      paint: {
        'fill-color': [
          'match',
          ['get', 'kind'],
          [
            'park',
            'national_park',
            'nature_reserve',
            'garden',
            'recreation_ground',
            'pitch',
          ],
          palette.landuse.park,
          ['beach', 'sand'],
          palette.landuse.beach,
          'cemetery',
          palette.landuse.cemetery,
          ['hospital', 'clinic'],
          palette.landuse.hospital,
          ['school', 'university', 'college', 'kindergarten'],
          palette.landuse.school,
          ['industrial', 'railway', 'quarry'],
          palette.landuse.industrial,
          ['aerodrome', 'runway', 'taxiway'],
          palette.landuse.aerodrome,
          ['pedestrian', 'footway', 'square'],
          palette.landuse.pedestrian,
          palette.earth,
        ],
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0, 10, 0.9],
      },
    },
  ]
}

function waterLayers(palette: MapPalette): Array<MapLayer> {
  return [
    {
      id: MAP_LAYER_IDS.water,
      type: 'fill',
      source: BASEMAP_SOURCE_ID,
      'source-layer': 'water',
      paint: { 'fill-color': palette.water },
    },
    {
      // The coastline hairline. A fill alone leaves land and sea meeting on a
      // soft antialiased edge; a half-pixel line gives the map an engraved
      // quality that survives being viewed at any size.
      id: 'pt-water-edge',
      type: 'line',
      source: BASEMAP_SOURCE_ID,
      'source-layer': 'water',
      paint: {
        'line-color': palette.waterEdge,
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          2,
          0.4,
          8,
          0.8,
          14,
          1.2,
        ],
        'line-opacity': 0.9,
      },
    },
    {
      id: 'pt-water-line',
      type: 'line',
      source: BASEMAP_SOURCE_ID,
      'source-layer': 'physical_line',
      minzoom: 7,
      filter: kindIn(['river', 'stream', 'canal', 'ditch']),
      paint: {
        'line-color': palette.water,
        'line-width': [
          'interpolate',
          ['exponential', 1.5],
          ['zoom'],
          7,
          0.6,
          12,
          1.6,
          16,
          4,
        ],
      },
    },
  ]
}

function roadLayers(palette: MapPalette): Array<MapLayer> {
  const tiers: ReadonlyArray<RoadTier> = [
    {
      id: 'pt-road-minor',
      kinds: ['minor_road', 'other'],
      fill: palette.road.minor,
      casing: palette.road.minorCasing,
      minzoom: 12,
      widths: [
        [12, 0.4],
        [14, 1.1],
        [16, 3],
        [18, 8],
      ],
    },
    {
      id: 'pt-road-medium',
      kinds: ['medium_road'],
      fill: palette.road.medium,
      casing: palette.road.mediumCasing,
      minzoom: 10,
      widths: [
        [10, 0.5],
        [13, 1.4],
        [16, 4.5],
        [18, 11],
      ],
    },
    {
      id: MAP_LAYER_IDS.roads,
      kinds: ['major_road'],
      fill: palette.road.major,
      casing: palette.road.majorCasing,
      minzoom: 6,
      widths: [
        [6, 0.5],
        [10, 1.2],
        [13, 2.6],
        [16, 7],
        [18, 15],
      ],
    },
    {
      id: 'pt-road-highway',
      kinds: ['highway'],
      fill: palette.road.highway,
      casing: palette.road.highwayCasing,
      minzoom: 4,
      widths: [
        [4, 0.6],
        [8, 1.3],
        [12, 3],
        [16, 9],
        [18, 18],
      ],
    },
  ]

  return [
    {
      id: 'pt-path',
      type: 'line',
      source: BASEMAP_SOURCE_ID,
      'source-layer': 'roads',
      minzoom: 14,
      filter: kindIn(['path']),
      paint: {
        'line-color': palette.road.path,
        'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.6, 18, 2],
        'line-dasharray': [2, 2],
      },
    },
    ...tiers.flatMap((tier) => roadTier(tier, 0.9)),
    {
      id: 'pt-transit-rail',
      type: 'line',
      source: BASEMAP_SOURCE_ID,
      'source-layer': 'transit',
      minzoom: 10,
      filter: kindIn(['railway', 'rail']),
      paint: {
        'line-color': palette.road.rail,
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10,
          0.5,
          14,
          1.1,
          18,
          2.4,
        ],
        'line-dasharray': [4, 2],
      },
    },
    {
      id: 'pt-transit-ferry',
      type: 'line',
      source: BASEMAP_SOURCE_ID,
      'source-layer': 'transit',
      minzoom: 6,
      filter: kindIn(['ferry']),
      paint: {
        'line-color': palette.road.ferry,
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 12, 1.1],
        'line-dasharray': [1, 3],
        'line-opacity': 0.8,
      },
    },
  ]
}

function boundaryLayers(palette: MapPalette): Array<MapLayer> {
  return [
    {
      id: 'pt-boundary-region',
      type: 'line',
      source: BASEMAP_SOURCE_ID,
      'source-layer': 'boundaries',
      minzoom: 4,
      filter: ['>=', ['coalesce', ['get', 'kind_detail'], 3], 3],
      paint: {
        'line-color': palette.boundary.region,
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.4, 10, 0.9],
        'line-dasharray': [3, 2],
      },
    },
    {
      id: 'pt-boundary-country',
      type: 'line',
      source: BASEMAP_SOURCE_ID,
      'source-layer': 'boundaries',
      filter: ['<=', ['coalesce', ['get', 'kind_detail'], 2], 2],
      paint: {
        'line-color': palette.boundary.country,
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          1,
          0.5,
          6,
          1.1,
          12,
          1.8,
        ],
      },
    },
  ]
}

function buildingLayer(palette: MapPalette): MapLayer {
  return {
    id: MAP_LAYER_IDS.buildings,
    type: 'fill',
    source: BASEMAP_SOURCE_ID,
    'source-layer': 'buildings',
    minzoom: 14,
    paint: {
      'fill-color': palette.building,
      'fill-outline-color': palette.buildingEdge,
      // Buildings arrive as the reader crosses into street scale, never as a
      // hard switch — a full-opacity pop at z14 reads as a rendering fault.
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.5, 1],
    },
  }
}

function labelLayers(
  palette: MapPalette,
  options: { readonly roadLabels: boolean; readonly poiLabels: boolean },
): Array<MapLayer> {
  const haloWidth = 1.4

  const layers: Array<MapLayer> = [
    {
      id: MAP_LAYER_IDS.labelAnchor,
      type: 'symbol',
      source: BASEMAP_SOURCE_ID,
      'source-layer': 'water',
      minzoom: 4,
      filter: hasName(),
      layout: {
        'text-field': labelText(),
        'text-font': [...MAP_FONT_MEDIUM],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 12, 13],
        'text-letter-spacing': 0.06,
        'text-max-width': 7,
        'symbol-placement': 'point',
      },
      paint: {
        'text-color': palette.label.water,
        'text-halo-color': palette.label.waterHalo,
        'text-halo-width': haloWidth,
        'text-halo-blur': 0.4,
      },
    },
    {
      id: 'pt-label-country',
      type: 'symbol',
      source: BASEMAP_SOURCE_ID,
      'source-layer': 'places',
      minzoom: 2,
      maxzoom: 9,
      filter: ['all', hasName(), kindIn(['country'])],
      layout: {
        'text-field': labelText(),
        'text-font': [...MAP_FONT_SEMIBOLD],
        'text-size': ['interpolate', ['linear'], ['zoom'], 2, 10, 6, 14],
        'text-transform': 'uppercase',
        // The 0.08em tracking of `SectionLabel`, expressed in MapLibre's em units.
        'text-letter-spacing': 0.08,
        'text-max-width': 8,
      },
      paint: {
        'text-color': palette.label.country,
        'text-halo-color': palette.label.halo,
        'text-halo-width': haloWidth,
      },
    },
    {
      id: 'pt-label-region',
      type: 'symbol',
      source: BASEMAP_SOURCE_ID,
      'source-layer': 'places',
      minzoom: 4,
      maxzoom: 11,
      filter: ['all', hasName(), kindIn(['region', 'province', 'state'])],
      layout: {
        'text-field': labelText(),
        'text-font': [...MAP_FONT_MEDIUM],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9, 9, 12],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.08,
        'text-max-width': 8,
      },
      paint: {
        'text-color': palette.label.region,
        'text-halo-color': palette.label.halo,
        'text-halo-width': haloWidth,
      },
    },
    {
      id: MAP_LAYER_IDS.localityLabels,
      type: 'symbol',
      source: BASEMAP_SOURCE_ID,
      'source-layer': 'places',
      minzoom: 3,
      filter: [
        'all',
        hasName(),
        kindIn(['city', 'locality', 'town', 'village']),
      ],
      layout: {
        'text-field': labelText(),
        'text-font': [...MAP_FONT_SEMIBOLD],
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3,
          11,
          8,
          13,
          14,
          17,
        ],
        'text-max-width': 8,
        'text-padding': 4,
        // Bigger places win the collision, so a dense region still reads.
        'symbol-sort-key': ['coalesce', ['get', 'population_rank'], 0],
      },
      paint: {
        'text-color': palette.label.city,
        'text-halo-color': palette.label.halo,
        'text-halo-width': 1.6,
        'text-halo-blur': 0.3,
      },
    },
    {
      id: 'pt-label-neighbourhood',
      type: 'symbol',
      source: BASEMAP_SOURCE_ID,
      'source-layer': 'places',
      minzoom: 12,
      filter: [
        'all',
        hasName(),
        kindIn(['neighbourhood', 'suburb', 'quarter']),
      ],
      layout: {
        'text-field': labelText(),
        'text-font': [...MAP_FONT_MEDIUM],
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 16, 12],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.08,
        'text-max-width': 9,
      },
      paint: {
        'text-color': palette.label.neighbourhood,
        'text-halo-color': palette.label.halo,
        'text-halo-width': haloWidth,
      },
    },
  ]

  if (options.roadLabels) {
    layers.push({
      id: 'pt-label-road',
      type: 'symbol',
      source: BASEMAP_SOURCE_ID,
      'source-layer': 'roads',
      minzoom: 13,
      filter: [
        'all',
        hasName(),
        kindIn(['highway', 'major_road', 'medium_road']),
      ],
      layout: {
        'text-field': labelText(),
        'text-font': [...MAP_FONT_REGULAR],
        'text-size': ['interpolate', ['linear'], ['zoom'], 13, 9, 17, 11],
        'symbol-placement': 'line',
        'text-rotation-alignment': 'map',
        'text-pitch-alignment': 'viewport',
        'symbol-spacing': 320,
        'text-max-angle': 30,
      },
      paint: {
        'text-color': palette.label.road,
        'text-halo-color': palette.label.halo,
        'text-halo-width': 1.6,
      },
    })
  }

  if (options.poiLabels) {
    layers.push({
      id: 'pt-label-poi',
      type: 'symbol',
      source: BASEMAP_SOURCE_ID,
      'source-layer': 'pois',
      minzoom: 15,
      filter: hasName(),
      layout: {
        'text-field': labelText(),
        'text-font': [...MAP_FONT_REGULAR],
        'text-size': ['interpolate', ['linear'], ['zoom'], 15, 9.5, 18, 11.5],
        'text-max-width': 8,
        'text-offset': [0, 0.4],
        'text-anchor': 'top',
      },
      paint: {
        'text-color': palette.label.poi,
        'text-halo-color': palette.label.halo,
        'text-halo-width': haloWidth,
      },
    })
  }

  return layers
}

/* -------------------------------------------------------------------------------------------------
 * Ground underlay
 * ---------------------------------------------------------------------------------------------- */

/** Fades the underlay out as the reader zooms past what our own data can claim. */
function groundFade(from: number, to: number): MapExpression {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    GROUND_MIN_ZOOM,
    from,
    GROUND_FADE_MAX_ZOOM,
    to,
  ]
}

/**
 * The same fade, plus a quiet tail at world scale.
 *
 * `interpolate` clamps below its first stop, so `groundFade` alone holds the grid
 * at full strength all the way out to zoom 0 — where a 2° step is a line every few
 * pixels. One extra stop at the low end is the whole fix.
 */
function graticuleFade(peak: number): MapExpression {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    GRATICULE_WORLD_ZOOM,
    GRATICULE_WORLD_OPACITY * peak,
    GROUND_MIN_ZOOM,
    peak,
    GROUND_FADE_MAX_ZOOM,
    0,
  ]
}

/**
 * The grid, quietened at world scale.
 *
 * The graticule is generated at one fixed step, so its density on screen is
 * decided entirely by the camera: the step that gives a trip-sized frame half a
 * dozen useful reference lines gives a whole-world frame a line every few
 * pixels. Rather than regenerate the source per zoom, the grid simply stands
 * down the further out the reader is — which is also the scale at which the
 * coastlines beneath it are doing the work. `interpolate` clamps above its last
 * stop, so from {@link GROUND_MIN_ZOOM} up this is exactly full strength.
 */
function graticuleWorldFade(): MapExpression {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    GRATICULE_WORLD_ZOOM,
    GRATICULE_WORLD_OPACITY,
    GROUND_MIN_ZOOM,
    1,
  ]
}

/**
 * A ground of our own, for the parts of the world the archive does not carry.
 *
 * Drawn *beneath* every vector layer, so inside the archive's extent it is
 * completely hidden by the real cartography and costs nothing but a fill. Outside
 * it — a trip to Lisbon against a Japan archive — it is the difference between a
 * map and an empty rectangle: sea, coastline, land and a drafting graticule, all
 * generated from data we ship, so it renders offline and never half-loads.
 */
function groundLayers(palette: MapPalette): Array<MapLayer> {
  return [
    {
      id: 'pt-ground',
      type: 'background',
      paint: {
        // The one layer that is always painted, at every zoom, everywhere. It
        // starts as sea so the coastlines below read as coastlines, and lands on
        // the warm out-of-data ground once the underlay has faded.
        'background-color': [
          'interpolate',
          ['linear'],
          ['zoom'],
          GROUND_MIN_ZOOM,
          palette.water,
          GROUND_FADE_MAX_ZOOM,
          palette.background,
        ],
      },
    },
    {
      id: 'pt-ground-land',
      type: 'fill',
      source: WORLD_LAND_SOURCE_ID,
      paint: {
        'fill-color': palette.earth,
        'fill-opacity': groundFade(1, 0),
      },
    },
    {
      id: 'pt-ground-coast',
      type: 'line',
      source: WORLD_LAND_SOURCE_ID,
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': palette.waterEdge,
        'line-width': 0.8,
        'line-opacity': groundFade(1, 0),
      },
    },
    {
      id: 'pt-ground-graticule',
      type: 'line',
      source: GRATICULE_SOURCE_ID,
      filter: ['!', ['get', 'major']],
      paint: {
        'line-color': palette.fallback.graticule,
        'line-width': 1,
        'line-opacity': graticuleFade(0.9),
      },
    },
    {
      id: 'pt-ground-graticule-major',
      type: 'line',
      source: GRATICULE_SOURCE_ID,
      filter: ['get', 'major'],
      paint: {
        'line-color': palette.fallback.graticuleMajor,
        'line-width': 1.25,
        'line-opacity': graticuleFade(0.9),
      },
    },
  ]
}

/* -------------------------------------------------------------------------------------------------
 * Styles
 * ---------------------------------------------------------------------------------------------- */

/**
 * The full vector basemap for one theme.
 *
 * Layer order is the whole game: ground, then cover, then water, then the road
 * silhouette, then buildings, then boundaries, then type. Anything a caller adds
 * belongs above {@link MAP_LAYER_IDS.roads} and below
 * {@link MAP_LAYER_IDS.labelAnchor}.
 */
export function basemapStyle(options: BasemapStyleOptions): MapStyle {
  const palette = mapPalette(options.theme)
  const endpoints = tileEndpoints({
    origin: options.origin,
    archive: options.archive,
  })

  const ground = options.ground === true

  return {
    version: 8,
    name: `planned.travel ${options.theme}`,
    sources: {
      [BASEMAP_SOURCE_ID]: {
        type: 'vector',
        url: endpoints.pmtiles,
        attribution: ATTRIBUTION_HTML,
      },
      ...(ground
        ? {
            [WORLD_LAND_SOURCE_ID]: {
              type: 'geojson' as const,
              data: worldLandFeatures(),
            },
            [GRATICULE_SOURCE_ID]: {
              type: 'geojson' as const,
              data: graticule(options.graticule),
            },
          }
        : {}),
    },
    // A warm ground behind everything means a slow tile never shows as grey.
    layers: [
      ...(ground ? groundLayers(palette) : []),
      ...landLayers(palette, { background: !ground }),
      ...waterLayers(palette),
      ...roadLayers(palette),
      ...(options.buildings === false ? [] : [buildingLayer(palette)]),
      ...boundaryLayers(palette),
      ...labelLayers(palette, {
        roadLabels: options.roadLabels !== false,
        poiLabels: options.poiLabels === true,
      }),
    ],
  }
}

/**
 * The style used when no archive is reachable.
 *
 * There are no *tiles* without an archive, but there is still a world: the same
 * generalised coastlines the ground underlay draws are bundled with the app, so
 * the honest degradation is a real map of the planet rather than a sheet of
 * graph paper. Sea first, then land, then a coastline hairline, then the
 * drafting graticule over both — which is what makes an island read as an island
 * instead of as a shape on the page ground.
 *
 * The sea matters as much as the land. Without it every fill a consumer paints
 * on top — a visited country, a corridor, a heat blob — would border the page
 * rather than water, and the contrast ratios the palette measures against
 * {@link MapPalette.water} would describe a colour that is nowhere on screen.
 *
 * The world hands over rather than overstaying, on exactly the terms the ground
 * underlay uses: our coastlines are generalised to about nine kilometres, which
 * is a fraction of a pixel across a continent and a pin in the sea across a
 * city. So the sea drains to warm paper and the land dissolves into it between
 * {@link GROUND_MIN_ZOOM} and {@link GROUND_FADE_MAX_ZOOM}, leaving the drafting
 * graticule as the only claim being made at street scale — which is the only
 * claim we can honestly make there.
 *
 * Pins, routes and the camera all keep working, and the reader can still see
 * that a place sits at a real latitude. Deliberately free of symbol layers, so
 * it never requests a glyph range that is equally missing, and free of any
 * network reference at all, so it renders offline and never half-loads.
 */
export function fallbackStyle(options: FallbackStyleOptions): MapStyle {
  const palette = mapPalette(options.theme)

  return {
    version: 8,
    name: `planned.travel ${options.theme} (bundled outlines)`,
    sources: {
      [WORLD_LAND_SOURCE_ID]: {
        type: 'geojson',
        data: worldLandFeatures(),
      },
      [GRATICULE_SOURCE_ID]: {
        type: 'geojson',
        data: graticule(options.graticule),
      },
    },
    layers: [
      {
        id: FALLBACK_LAYER_IDS.background,
        type: 'background',
        // Sea at every scale the coastlines are true at, and the warm page once
        // they have gone — so the sheet the reader is left with at street scale
        // is paper, not an ocean with nothing in it.
        paint: {
          'background-color': [
            'interpolate',
            ['linear'],
            ['zoom'],
            GROUND_MIN_ZOOM,
            palette.water,
            GROUND_FADE_MAX_ZOOM,
            palette.earth,
          ],
        },
      },
      {
        id: FALLBACK_LAYER_IDS.land,
        type: 'fill',
        source: WORLD_LAND_SOURCE_ID,
        paint: {
          'fill-color': palette.earth,
          'fill-opacity': groundFade(1, 0),
        },
      },
      {
        id: FALLBACK_LAYER_IDS.coast,
        type: 'line',
        source: WORLD_LAND_SOURCE_ID,
        layout: { 'line-join': 'round' },
        paint: {
          'line-color': palette.waterEdge,
          // Generalised to about nine kilometres, so the line thickens with the
          // camera rather than staying a hairline the reader has to hunt for.
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.8, 6, 1.6],
          'line-opacity': groundFade(1, 0),
        },
      },
      {
        id: FALLBACK_LAYER_IDS.graticule,
        type: 'line',
        source: GRATICULE_SOURCE_ID,
        filter: ['!', ['get', 'major']],
        paint: {
          'line-color': palette.fallback.graticule,
          // A whole pixel at the floor: half a pixel of a near-paper colour is
          // not a line, it is a rumour.
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1, 8, 1.25],
          'line-opacity': graticuleWorldFade(),
        },
      },
      {
        id: FALLBACK_LAYER_IDS.graticuleMajor,
        type: 'line',
        source: GRATICULE_SOURCE_ID,
        filter: ['get', 'major'],
        paint: {
          'line-color': palette.fallback.graticuleMajor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.25, 8, 2],
          'line-opacity': graticuleWorldFade(),
        },
      },
    ],
  }
}

/** Picks the right style for what is actually available. */
export function mapStyleFor(
  options: BasemapStyleOptions & { readonly basemapAvailable: boolean },
): MapStyle {
  return options.basemapAvailable
    ? basemapStyle(options)
    : fallbackStyle(options)
}
