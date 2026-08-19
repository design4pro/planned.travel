/**
 * The basemap palette.
 *
 * A MapLibre style sheet is JSON: it cannot read a CSS custom property, so the
 * cartography needs literal colours. This module is the one place those
 * literals live, and every one of them either **is** a value from
 * `src/styles/tokens.css` (noted in the trailing comment) or is derived from one
 * by a stated rule. `tokens.css` remains the source of truth — when a token
 * moves, change it there first and then mirror it here.
 *
 * Two full palettes, light and dark, built to the intent in `docs/DESIGN.md`:
 * warm paper land, muted water, restrained road hierarchy, ink-tier labels.
 * Dark is a warm charcoal cartography in its own right, never an inverted copy
 * of the light one.
 *
 * One group is not cartography at all. {@link CountryPalette} paints the atlas,
 * where the colour of a country is the traveller's own record rather than a
 * description of the ground, and it is held to a different rule: one hue, and
 * lightness that means something.
 */

import type { ResolvedTheme } from '#/lib/theme'

/** Ground tints for the natural-cover layers Protomaps ships. */
export interface LandcoverPalette {
  readonly forest: string
  readonly grass: string
  readonly scrub: string
  readonly sand: string
  readonly glacier: string
  readonly farmland: string
  readonly urban: string
}

/** Ground tints for human land use. */
export interface LandusePalette {
  readonly park: string
  readonly beach: string
  readonly cemetery: string
  readonly hospital: string
  readonly school: string
  readonly industrial: string
  readonly aerodrome: string
  readonly pedestrian: string
}

/**
 * Roads are drawn as a casing/fill pair so the hierarchy reads from the
 * *silhouette* rather than from six competing hues.
 */
export interface RoadPalette {
  readonly highway: string
  readonly highwayCasing: string
  readonly major: string
  readonly majorCasing: string
  readonly medium: string
  readonly mediumCasing: string
  readonly minor: string
  readonly minorCasing: string
  readonly path: string
  readonly rail: string
  readonly ferry: string
}

/**
 * The itinerary line drawn over the cartography.
 *
 * Not part of the basemap, but it has to be declared here for the same reason
 * everything else is: a MapLibre paint property is JSON and cannot read a CSS
 * custom property, so the one place literal colours are allowed to live is this
 * file. `line` is the brand pine as seen against the map's own ground; `casing`
 * is the ground itself, which is what keeps a route legible as it crosses a park,
 * a river and a motorway inside one block.
 */
export interface RouteLinePalette {
  readonly line: string
  readonly casing: string
}

export interface BoundaryPalette {
  readonly country: string
  readonly region: string
}

/**
 * The atlas country layer — the one place on the map where colour is *data*.
 *
 * Every other palette here describes the world. This one describes what the
 * traveller has done with it, so it is deliberately one hue: the brand pine,
 * with lightness carrying how recently the country was last visited
 * (`visitedDistant` → `visited` → `visitedRecent`) and two further steps
 * carrying attention (`visitedHover`, `visitedSelected`). A colour picked per
 * country by index would be decoration wearing the costume of data, and two
 * neighbours would collide for no reason at all. All five steps are evenly
 * spaced — adjacent pairs sit 6.1–6.4 CIE L* apart in both themes.
 *
 * A visited country has two neighbours, not one. It borders unvisited land, and
 * at every coast it borders {@link MapPalette.water} — which for an island such
 * as Iceland, New Zealand, Fiji or Madagascar is the *only* thing it borders.
 * Both pairings clear the 3:1 WCAG 1.4.11 floor for a graphical object, and the
 * water pairing is the tighter of the two: it is what fixes the faint end of the
 * ramp in light.
 *
 * `visitedEdge` is the hairline drawn around a visited country, and it separates
 * two adjacent visited fills: the page knocked back through the fill in light,
 * a mid-pine groove in dark.
 *
 * `land*` is the unvisited world, which is the product's inset surface.
 *
 * Lightness on its own is not decodable into a date — adjacent recency steps are
 * 1.2–1.3:1 apart — so any surface painted with this ramp has to ship a legend
 * or per-country labels to satisfy WCAG 1.4.1. The colour is the shape of the
 * data, never the only statement of it.
 *
 * Mirrors the `--color-country-*` group in `src/styles/tokens.css` value for
 * value; that file is the source of truth.
 */
export interface CountryPalette {
  /** Unvisited land. */
  readonly land: string
  /** The hairline between two unvisited countries. */
  readonly landEdge: string
  /** Unvisited land under the pointer — the "you could mark this" wash. */
  readonly landHover: string
  /** Visited, with no date on the record to place it on the ramp. */
  readonly visited: string
  /** Visited most recently — the strongest end of the ramp. */
  readonly visitedRecent: string
  /** Visited longest ago — the faintest end of the ramp. */
  readonly visitedDistant: string
  /** The hairline drawn around a visited country. */
  readonly visitedEdge: string
  /** Visited, under the pointer. */
  readonly visitedHover: string
  /** Visited, and the country the rest of the screen is currently about. */
  readonly visitedSelected: string
}

export interface LabelPalette {
  readonly country: string
  readonly region: string
  readonly city: string
  readonly locality: string
  readonly neighbourhood: string
  readonly water: string
  readonly road: string
  readonly poi: string
  /** Halo behind every land label — the page ground, so text sits *in* the map. */
  readonly halo: string
  /** Halo behind water labels, which sit on a cooler ground. */
  readonly waterHalo: string
}

/**
 * Treatment for the "no archive" style: a warm sheet of paper with a drafting
 * graticule, so a missing basemap reads as a designed state rather than a void.
 */
export interface FallbackPalette {
  readonly graticule: string
  readonly graticuleMajor: string
}

export interface MapPalette {
  /** Beyond the data envelope — the colour you see when you pan off the world. */
  readonly background: string
  /** Land. */
  readonly earth: string
  readonly water: string
  /** Coast and lake hairline. */
  readonly waterEdge: string
  readonly landcover: LandcoverPalette
  readonly landuse: LandusePalette
  readonly building: string
  readonly buildingEdge: string
  readonly road: RoadPalette
  readonly route: RouteLinePalette
  readonly boundary: BoundaryPalette
  readonly country: CountryPalette
  readonly label: LabelPalette
  readonly fallback: FallbackPalette
}

/**
 * Light — warm paper.
 *
 * Land is the page itself (`--color-canvas`), so the map and the panels floating
 * over it share one ground. Everything above it is a warm neutral half-step off
 * that page; water is the only cool note, pulled from the brand pine and
 * desaturated until it reads as ink-on-paper rather than as a screen blue.
 */
const LIGHT: MapPalette = {
  background: '#f1eee8', // --color-surface-inset, one step warmer
  earth: '#faf9f7', // --color-canvas
  water: '#ccdfda', // --color-brand mixed ~18% into --color-canvas
  waterEdge: '#b3ccc5', // water, one value darker — the coastline hairline
  landcover: {
    forest: '#e9eee3',
    grass: '#eef1e8',
    scrub: '#f0f1e7',
    sand: '#f6f0df',
    glacier: '#f4f7f8',
    farmland: '#f4f2e9',
    urban: '#f5f3ee',
  },
  landuse: {
    park: '#e6efe4',
    beach: '#f7efd9',
    cemetery: '#eaefe6',
    hospital: '#f8ece9',
    school: '#f2f0e9',
    industrial: '#f1efe9',
    aerodrome: '#eeece7',
    pedestrian: '#f4f2ed',
  },
  building: '#eeeae1',
  buildingEdge: '#e3e0d8', // --color-edge
  road: {
    highway: '#ffffff', // --color-surface
    highwayCasing: '#d8d1c2',
    major: '#ffffff',
    majorCasing: '#ded8ca',
    medium: '#fdfcfa',
    mediumCasing: '#e5e0d5',
    minor: '#f9f8f4',
    minorCasing: '#e9e4da',
    path: '#d7d1c4',
    rail: '#dcd6c9',
    ferry: '#a7c1bb',
  },
  boundary: {
    country: '#bcb6a6',
    region: '#d3ccbe',
  },
  // The two measurements that decide whether the atlas reads. Against `land`:
  // distant 3.76:1 · base 4.71:1 · recent 5.95:1 · hover 7.47:1 · selected
  // 9.37:1. Against `water` above, the ground an island country borders and
  // the tighter of the two: distant 3.23:1 · base 4.04:1 · recent 5.11:1 ·
  // hover 6.42:1 · selected 8.04:1. `visitedEdge` clears 3.95:1 against the
  // faintest fill; it is a knockout of the page, so on water it reads 1.22:1
  // and stands down — at a coast the fill is already over 3:1 on the sea.
  country: {
    land: '#edebe6', // --color-country-land (= --color-surface-inset)
    landEdge: '#c8c1af', // --color-country-land-edge
    landHover: '#ded8c8', // --color-country-land-hover
    visited: '#2b7365', // --color-country-visited
    visitedRecent: '#256256', // --color-country-visited-recent (= --color-brand)
    visitedDistant: '#328474', // --color-country-visited-distant
    visitedEdge: '#e9f3ef', // --color-country-visited-edge
    visitedHover: '#1f5248', // --color-country-visited-hover
    visitedSelected: '#19423a', // --color-country-visited-selected
  },
  label: {
    country: '#403e36', // --color-ink-2
    region: '#5b5951', // --color-ink-3
    city: '#16150f', // --color-ink
    locality: '#403e36', // --color-ink-2
    neighbourhood: '#5b5951', // --color-ink-3
    water: '#1c4e45', // --color-brand-hover
    road: '#5b5951', // --color-ink-3
    poi: '#6c6a61', // --color-ink-4
    halo: '#faf9f7', // --color-canvas
    waterHalo: '#e7f0ed', // water lightened toward the canvas
  },
  route: {
    line: '#256256', // --color-brand
    casing: '#faf9f7', // --color-canvas
  },
  fallback: {
    // Two steps darker than the paper, not one. At the sub-pixel widths a
    // graticule is drawn with, the previous pair differed from `earth` by about
    // 5% luminance and antialiasing swallowed what was left — the "sheet of
    // paper with drafting lines on it" arrived as a blank white panel.
    graticule: '#dcd6c6',
    graticuleMajor: '#c2bba7',
  },
}

/**
 * Dark — warm charcoal.
 *
 * Land is `--color-surface-inset`, water is near-black with a pine cast, and the
 * gap between them is the whole design. It has to be stated in **lightness**, not
 * in a contrast ratio: down here the +0.05 term in the WCAG formula swamps
 * everything, so `#1a1a18` land against `#0f1e1b` water scores a respectable-
 * looking 1.01:1 while differing by 0.7 in CIE L* — which is to say the coastline,
 * the single most important line on any map, was invisible. Land now sits at
 * L* ≈ 17 and water at L* ≈ 8, a ~9-point step that reads instantly at every zoom
 * without turning a dark map grey. Buildings and the water hairline were lifted
 * with it so the hierarchy above land survived the move.
 */
const DARK: MapPalette = {
  background: '#0d0d0c', // one step below --color-canvas
  earth: '#2a2a27', // --color-surface-inset
  water: '#0c1a17', // --color-brand darkened into the canvas
  waterEdge: '#1e4038', // the coastline hairline, pine and readable against land
  landcover: {
    forest: '#232b25',
    grass: '#252d26',
    scrub: '#282b28',
    sand: '#302a20',
    glacier: '#2e3540',
    farmland: '#2a2c25',
    urban: '#282825',
  },
  landuse: {
    park: '#20302a',
    beach: '#332c1d',
    cemetery: '#232a24',
    hospital: '#332224',
    school: '#2b2a2a',
    industrial: '#282827',
    aerodrome: '#2a2a2a',
    pedestrian: '#313130',
  },
  building: '#34342f',
  buildingEdge: '#3f3f39',
  // Every tier sits above the new land value, and in the same order it did
  // before: lifting the ground without lifting the network would have dropped
  // minor roads to within a point of L* of the land they run across.
  road: {
    highway: '#5b5749',
    highwayCasing: '#121211', // --color-canvas, so the casing reads as a gap
    major: '#4d4940',
    majorCasing: '#141413',
    medium: '#423e36',
    mediumCasing: '#151514',
    minor: '#393630',
    minorCasing: '#171716',
    path: '#46433a',
    rail: '#3c3a35',
    ferry: '#356057',
  },
  boundary: {
    country: '#6b6860',
    region: '#4a473f',
  },
  // The ramp runs the other way here: on a charcoal map recency reads as more
  // light, not less. Against `land`: distant 4.20:1 · base 5.18:1 · recent
  // 6.32:1 · hover 7.64:1 · selected 9.16:1. Against `water`: distant 5.14:1 ·
  // base 6.34:1 · recent 7.74:1 · hover 9.35:1 · selected 11.22:1.
  //
  // `visitedEdge` is a groove rather than a knockout down here, and it is a mid
  // pine rather than the near-black it began as. Near-black measured 1.00:1 on
  // this water — identical luminance — so the outline of a coastal country
  // simply was not drawn where it mattered most. At L* 26 it holds 3.10:1
  // against the faintest fill it separates while sitting 18.1 L* above the
  // water (1.66:1) and 9.5 L* above unvisited land (1.35:1). As with the
  // coastline above, L* is the honest measure at this end of the scale.
  country: {
    land: '#292926', // --color-country-land (= --color-surface-inset, dark)
    landEdge: '#454540', // --color-country-land-edge
    landHover: '#35352f', // --color-country-land-hover
    visited: '#54a990', // --color-country-visited
    visitedRecent: '#5fbba0', // --color-country-visited-recent (= --color-brand)
    visitedDistant: '#449880', // --color-country-visited-distant
    visitedEdge: '#25433d', // --color-country-visited-edge
    visitedHover: '#79cbb2', // --color-country-visited-hover
    visitedSelected: '#93dbc6', // --color-country-visited-selected
  },
  label: {
    country: '#d8d6d0', // --color-ink-2
    region: '#adaba3', // --color-ink-3
    city: '#f8f7f4', // --color-ink
    locality: '#d8d6d0', // --color-ink-2
    neighbourhood: '#adaba3', // --color-ink-3
    water: '#5fbba0', // --color-brand
    road: '#adaba3', // --color-ink-3
    poi: '#939188', // --color-ink-4
    halo: '#121211', // --color-canvas
    waterHalo: '#0b1614',
  },
  route: {
    line: '#4fa88e', // --color-brand, dark theme
    casing: '#121211', // --color-canvas, dark theme
  },
  fallback: {
    graticule: '#3d3d38',
    graticuleMajor: '#4f4f48', // one step past --color-edge
  },
}

/** Both palettes, keyed by the theme the rest of the app resolves to. */
export const MAP_PALETTES: Readonly<Record<ResolvedTheme, MapPalette>> = {
  light: LIGHT,
  dark: DARK,
}

/** The palette for a resolved theme. */
export function mapPalette(theme: ResolvedTheme): MapPalette {
  return MAP_PALETTES[theme]
}
