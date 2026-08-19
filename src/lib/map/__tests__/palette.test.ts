import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { MAP_PALETTES, mapPalette } from '../palette'

import type { ResolvedTheme } from '#/lib/theme'

/**
 * The palette is a literal mirror of `src/styles/tokens.css`, so the compiler
 * can only check its *shape*. Everything that decides whether the map actually
 * reads — that light and dark declare the same things, that every value is a
 * colour, that a visited country stands off the land it sits in, that the
 * mirror still says what the token file says — is arithmetic or text, and it is
 * checked here instead.
 */

const HEX = /^#[0-9a-f]{6}$/

const THEMES: readonly ResolvedTheme[] = ['light', 'dark']

/** Every leaf of a palette, addressed as `road.highwayCasing`. */
function flatten(
  node: unknown,
  prefix: string,
  into: Map<string, string>,
): void {
  if (typeof node === 'string') {
    into.set(prefix, node)
    return
  }
  if (typeof node === 'object' && node !== null) {
    for (const [key, value] of Object.entries(
      node as Record<string, unknown>,
    )) {
      flatten(value, prefix === '' ? key : `${prefix}.${key}`, into)
    }
    return
  }
  throw new Error(`palette leaf at "${prefix}" is neither a colour nor a group`)
}

function leaves(theme: ResolvedTheme): Map<string, string> {
  const out = new Map<string, string>()
  flatten(MAP_PALETTES[theme], '', out)
  return out
}

function channels(hex: string): { r: number; g: number; b: number } {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16) / 255,
    g: Number.parseInt(hex.slice(3, 5), 16) / 255,
    b: Number.parseInt(hex.slice(5, 7), 16) / 255,
  }
}

/** WCAG 2.2 relative luminance. */
function luminance(hex: string): number {
  const { r, g, b } = channels(hex)
  const linear = (c: number): number =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** WCAG 2.2 contrast ratio, 1:1 … 21:1. */
function contrast(a: string, b: string): number {
  const first = luminance(a)
  const second = luminance(b)
  const hi = Math.max(first, second)
  const lo = Math.min(first, second)
  return (hi + 0.05) / (lo + 0.05)
}

/** Saturation as the plain RGB span — enough to tell a tint from a neutral. */
function saturation(hex: string): number {
  const { r, g, b } = channels(hex)
  return Math.max(r, g, b) - Math.min(r, g, b)
}

/** Hue in degrees. Cheap, and enough to prove the visited tones share one. */
function hue(hex: string): number {
  const { r, g, b } = channels(hex)
  const max = Math.max(r, g, b)
  const span = max - Math.min(r, g, b)
  if (span === 0) return 0
  let sixths: number
  if (max === r) sixths = ((g - b) / span) % 6
  else if (max === g) sixths = (b - r) / span + 2
  else sixths = (r - g) / span + 4
  const degrees = sixths * 60
  return degrees < 0 ? degrees + 360 : degrees
}

/**
 * Every leaf the palette shipped with before the atlas needed a country group.
 * The trip plan screen reads this file, so a rename here is a silent break
 * there: this list may grow, never shrink.
 */
const ESTABLISHED_KEYS: readonly string[] = [
  'background',
  'earth',
  'water',
  'waterEdge',
  'building',
  'buildingEdge',
  'landcover.forest',
  'landcover.grass',
  'landcover.scrub',
  'landcover.sand',
  'landcover.glacier',
  'landcover.farmland',
  'landcover.urban',
  'landuse.park',
  'landuse.beach',
  'landuse.cemetery',
  'landuse.hospital',
  'landuse.school',
  'landuse.industrial',
  'landuse.aerodrome',
  'landuse.pedestrian',
  'road.highway',
  'road.highwayCasing',
  'road.major',
  'road.majorCasing',
  'road.medium',
  'road.mediumCasing',
  'road.minor',
  'road.minorCasing',
  'road.path',
  'road.rail',
  'road.ferry',
  'route.line',
  'route.casing',
  'boundary.country',
  'boundary.region',
  'label.country',
  'label.region',
  'label.city',
  'label.locality',
  'label.neighbourhood',
  'label.water',
  'label.road',
  'label.poi',
  'label.halo',
  'label.waterHalo',
  'fallback.graticule',
  'fallback.graticuleMajor',
]

/**
 * The visited tones, faintest first. The ramp is the first three (recency); the
 * last two are attention, and they carry on in the same direction so the whole
 * group reads as one scale rather than as five unrelated greens.
 */
const VISITED_TONES = [
  'visitedDistant',
  'visited',
  'visitedRecent',
  'visitedHover',
  'visitedSelected',
] as const

const COUNTRY_KEYS = [
  'land',
  'landEdge',
  'landHover',
  'visitedEdge',
  ...VISITED_TONES,
] as const

/**
 * `tokens.css`, cut into the three places a themed token is allowed to be
 * declared: the bare `:root` that carries light, the guarded
 * `prefers-color-scheme` block, and the explicit `[data-theme='dark']` block.
 */
function tokenContexts(): { light: string; media: string; attribute: string } {
  // Read as text, not imported: vitest stubs CSS modules out to nothing, and
  // the point of this file is the source the browser is handed.
  const here = dirname(fileURLToPath(import.meta.url))
  const css = readFileSync(
    join(here, '..', '..', '..', 'styles', 'tokens.css'),
    'utf8',
  )
  const media = css.indexOf('@media (prefers-color-scheme: dark) {')
  const attribute = css.indexOf(":root[data-theme='dark'] {")
  expect(media, 'guarded dark block').toBeGreaterThan(0)
  expect(attribute, 'explicit dark block').toBeGreaterThan(media)
  return {
    light: css.slice(0, media),
    media: css.slice(media, attribute),
    attribute: css.slice(attribute),
  }
}

/** The declared value of a custom property inside one slice of the token file. */
function declaredValue(slice: string, token: string): string | undefined {
  const match = new RegExp(`^\\s*${token}:\\s*([^;]+);`, 'm').exec(slice)
  return match === null ? undefined : match[1].trim()
}

/** `visitedEdge` → `--color-country-visited-edge`. */
function tokenFor(key: string): string {
  return `--color-country-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`
}

describe('MAP_PALETTES', () => {
  it('declares the same keys in light and dark', () => {
    const light = [...leaves('light').keys()].sort()
    const dark = [...leaves('dark').keys()].sort()
    expect(light).toEqual(dark)
    expect(light.length).toBeGreaterThan(0)
  })

  it('is nothing but six-digit lowercase hex', () => {
    for (const theme of THEMES) {
      for (const [key, value] of leaves(theme)) {
        expect(value, `${theme}.${key}`).toMatch(HEX)
      }
    }
  })

  it('keeps every key the rest of the product already reads', () => {
    for (const theme of THEMES) {
      const keys = leaves(theme)
      for (const key of ESTABLISHED_KEYS) {
        expect(keys.has(key), `${theme}.${key}`).toBe(true)
      }
    }
  })

  it('hands back the same object for a theme', () => {
    expect(mapPalette('light')).toBe(MAP_PALETTES.light)
    expect(mapPalette('dark')).toBe(MAP_PALETTES.dark)
  })
})

describe('the country group', () => {
  it('is present, complete and hex in both themes', () => {
    for (const theme of THEMES) {
      const country = MAP_PALETTES[theme].country
      expect(Object.keys(country).sort(), theme).toEqual(
        [...COUNTRY_KEYS].sort(),
      )
      for (const key of COUNTRY_KEYS) {
        expect(country[key], `${theme}.country.${key}`).toMatch(HEX)
      }
    }
  })

  it('stands a visited country at least 3:1 off unvisited land', () => {
    for (const theme of THEMES) {
      const country = MAP_PALETTES[theme].country
      for (const key of VISITED_TONES) {
        expect(
          contrast(country[key], country.land),
          `${theme}.country.${key} vs land`,
        ).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('keeps the visited hairline distinguishable from every fill it borders', () => {
    for (const theme of THEMES) {
      const country = MAP_PALETTES[theme].country
      for (const key of VISITED_TONES) {
        expect(
          contrast(country.visitedEdge, country[key]),
          `${theme}.country.visitedEdge vs ${key}`,
        ).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('runs one monotone ramp, strongest last', () => {
    // Light deepens, dark brightens — a dark cartography of its own rather than
    // the light ramp inverted. Either way the steps march one way and never
    // double back, which is what stops "older" from outshouting "last month".
    for (const theme of THEMES) {
      const country = MAP_PALETTES[theme].country
      const steps = VISITED_TONES.map((key) => luminance(country[key]))
      const marching = [...steps].sort((a, b) =>
        theme === 'light' ? b - a : a - b,
      )
      expect(steps, `${theme} visited ramp order`).toEqual(marching)
      expect(new Set(steps).size, `${theme} visited ramp has a flat step`).toBe(
        steps.length,
      )
    }
  })

  it('is one hue, not a palette handed out by index', () => {
    for (const theme of THEMES) {
      const country = MAP_PALETTES[theme].country
      const hues = VISITED_TONES.map((key) => hue(country[key]))
      for (const value of hues) {
        // Pine through to mint: one family, whatever the lightness.
        expect(value, theme).toBeGreaterThan(150)
        expect(value, theme).toBeLessThan(195)
      }
      expect(
        Math.max(...hues) - Math.min(...hues),
        `${theme} hue spread`,
      ).toBeLessThan(20)
    }
  })

  it('draws unvisited land as a neutral, so saturation only ever means "visited"', () => {
    for (const theme of THEMES) {
      const { land, landEdge, landHover } = MAP_PALETTES[theme].country
      for (const [key, value] of Object.entries({
        land,
        landEdge,
        landHover,
      })) {
        expect(saturation(value), `${theme}.country.${key}`).toBeLessThan(0.1)
      }
      // The hairline and the hover wash still have to be visible on the land.
      expect(contrast(landEdge, land), `${theme} landEdge`).toBeGreaterThan(1.3)
      expect(contrast(landHover, land), `${theme} landHover`).toBeGreaterThan(
        1.1,
      )
    }
  })
})

describe('the tokens.css mirror', () => {
  it('declares every country colour three times, light once and dark twice', () => {
    const { light, media, attribute } = tokenContexts()
    expect(
      media,
      'the dark block is guarded so an explicit light toggle wins',
    ).toContain(":root:not([data-theme='light'])")
    for (const key of COUNTRY_KEYS) {
      const token = tokenFor(key)
      const declared = {
        light: declaredValue(light, token),
        media: declaredValue(media, token),
        attribute: declaredValue(attribute, token),
      }
      expect(declared.light, `${token} on bare :root`).toBeDefined()
      expect(
        declared.media,
        `${token} under prefers-color-scheme: dark`,
      ).toBeDefined()
      expect(
        declared.attribute,
        `${token} under [data-theme='dark']`,
      ).toBeDefined()
      expect(
        declared.attribute,
        `${token} disagrees between the two dark blocks`,
      ).toBe(declared.media)
    }
  })

  it('carries the same literals the token file declares', () => {
    const { light, attribute } = tokenContexts()
    for (const key of COUNTRY_KEYS) {
      const token = tokenFor(key)
      expect(MAP_PALETTES.light.country[key], `light ${token}`).toBe(
        declaredValue(light, token),
      )
      expect(MAP_PALETTES.dark.country[key], `dark ${token}`).toBe(
        declaredValue(attribute, token),
      )
    }
  })

  it('gives map chrome a stacking order of its own, under the app nav', () => {
    // A stacking order has no light and dark value, so it lives with the other
    // layout tokens rather than being declared three times for the look of it.
    // The theme-independent block is the tail of the file, so it falls inside
    // the last slice along with the explicit dark theme.
    const { light, media, attribute } = tokenContexts()
    expect(
      declaredValue(light, '--z-map-overlay'),
      'themed copy',
    ).toBeUndefined()
    expect(
      declaredValue(media, '--z-map-overlay'),
      'themed copy',
    ).toBeUndefined()
    const overlay = declaredValue(attribute, '--z-map-overlay')
    const nav = declaredValue(attribute, '--z-nav')
    expect(overlay, '--z-map-overlay').toBeDefined()
    expect(nav, '--z-nav').toBeDefined()
    expect(
      Number(overlay),
      'map chrome must sit under the app nav',
    ).toBeLessThan(Number(nav))
  })
})
