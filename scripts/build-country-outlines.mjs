#!/usr/bin/env node

/**
 * Builds the finer country-outline asset served from `public/atlas/`.
 *
 *   node scripts/build-country-outlines.mjs [--source <path|url>] [--out <path>] [--check]
 *
 * With no arguments it fetches the pinned source, writes `public/atlas/` and
 * prints what it cut. `--source` takes a local mirror of that same dataset, for
 * an offline build; `--check` rebuilds and fails if the committed asset differs.
 * The manifest's provenance token names the pinned dataset, so `--source` is for
 * a copy of it rather than for a different scale.
 *
 * The bundled 1:110m cut in `src/lib/map/world.ts` exists so a map can always
 * draw land, and it is deliberately tiny: outer rings only, Douglas–Peucker at
 * 0.08°, 8,652 vertices. That is enough for a silhouette and not enough for a
 * travel tracker. Spain arrives as one 42-vertex ring with neither the Canaries
 * nor the Balearics; France as three; Réunion, Guadeloupe, Martinique, Mayotte
 * and 71 other assigned ISO codes cannot be filled at all. This script produces
 * the upgrade: the same encoding, the same quantisation grid, one source scale
 * finer, fetched over HTTP by `src/lib/map/countries.ts` rather than bundled.
 *
 * **Source.** Natural Earth 1:50m Admin 0 countries, pinned to a release tag so
 * two runs read the same bytes. Natural Earth's authors place it in the public
 * domain, and `src/lib/map/style.ts` already credits it, so the finer cut adds
 * no licence or attribution obligation. It stays the source for that reason:
 * the obvious alternative, geoBoundaries CGAZ, is CC BY 4.0 and would put a
 * new mandatory credit on every map surface in the product.
 *
 * **Dependencies.** None. Node built-ins only — `fetch`, `JSON.parse`, and the
 * simplifier below. The repository's dependency set is frozen, so there is no
 * topojson, no turf and no tippecanoe to reach for; a Douglas–Peucker pass and
 * a delta encoder are eighty lines and are cheaper to read than a dependency.
 *
 * **Determinism.** Two runs produce byte-identical output. The source is a
 * pinned tag, every ordering is derived from the data rather than from a hash
 * table's iteration order, every number is an integer, and nothing is stamped
 * with a clock. `--check` re-builds and diffs against the committed asset.
 *
 * ## Natural Earth's property traps
 *
 * The dataset's ISO columns are not a primary key, and every one of these was
 * observed in the pinned release rather than assumed:
 *
 * 1. `ISO_A2` is the string `'-99'` for France, Norway and Kosovo. Reading it
 *    naively loses three countries — including the one whose overseas
 *    départements are the reason for this asset. `ISO_A2_EH` carries the code
 *    for all three, so it is read first and `ISO_A2` is only the fallback.
 * 2. `'-99'` is a sentinel in both columns and is never a code. It is dropped
 *    wherever it appears, in either column.
 * 3. Three entities carry no ISO code at all in either column — Somaliland,
 *    Northern Cyprus and the Siachen Glacier. They are disputed or
 *    administrative, ISO assigns them nothing, and the atlas keys everything by
 *    alpha-2, so they are dropped rather than invented.
 * 4. One code spans several features. Australia is three of them — the
 *    mainland, the Indian Ocean Territories and Ashmore and Cartier Islands.
 *    Emitting a feature per source row would put two shapes on one
 *    `feature-state` id, and MapLibre would light whichever the hover last
 *    touched. Features are therefore merged **by code** into one multi-ring
 *    shape, so the asset holds exactly one entry per ISO code.
 *
 * A fifth trap is not a property but a schema choice. Natural Earth also ships
 * `admin_0_map_units`, which splits France into metropolitan France plus each
 * overseas département under its own ISO code. It would fill thirteen more
 * codes — but it also redefines what "France" means on the map, and the land it
 * draws is identical either way. Admin 0 countries is the sovereign cut, which
 * is what a country tracker colours, so the départements are drawn as part of
 * France and reported as unfillable codes by `src/lib/map/countries.ts`.
 *
 * ## The cut
 *
 * Outer rings only, matching the 1:110m bundle: a lake is not part of a
 * silhouette, and the fill layer draws smaller countries after larger ones (see
 * `byDrawingOrder`) so an enclave is not lost with the holes.
 *
 * Douglas–Peucker at 0.02° and quantisation to 0.01°. Both numbers come from
 * the zoom the layer actually reaches: `COUNTRY_SOURCE_MAX_ZOOM` is 5, one tile
 * pixel at zoom 5 spans 0.022° of longitude at the equator, and the fill has
 * faded out by zoom 6. Simplifying below a pixel of the deepest tile buys
 * memory and nothing visible.
 *
 * Simplification never costs a country. If a ring quantises to fewer than three
 * distinct vertices after simplification, the unsimplified ring is quantised
 * instead; if that still collapses, the ring is dropped. Vatican City's only
 * ring is 0.012° across and survives only because of that retry — see
 * {@link cutRing} for the eleven codes it rescues and the two it decides.
 */

import { argv, exit, stderr, stdout } from 'node:process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/* -------------------------------------------------------------------------------------------------
 * Configuration
 * ---------------------------------------------------------------------------------------------- */

/**
 * Natural Earth 1:50m Admin 0 countries, pinned to a release tag.
 *
 * A tag rather than a branch, because a branch would make the build's output a
 * function of the day it ran.
 */
const SOURCE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson'

/** Short provenance token written into the asset's manifest line. */
const SOURCE_ID = 'natural-earth-50m'

/** Asset format version. Bumping it means bumping the filename too. */
const FORMAT_VERSION = 1

/** Units per degree. A hundredth of a degree is about 1.1km at the equator. */
const GRID = 100

/** Douglas–Peucker tolerance, in grid units — 2 units is 0.02°. */
const TOLERANCE_UNITS = 2

/** Where the asset lands, relative to the repository root. */
const OUT_PATH = 'public/atlas/country-outlines-50m.v1.txt'

/** The sentinel Natural Earth writes where it has no ISO code. */
const NO_CODE = '-99'

/** Fewer than three distinct vertices enclose no area, so nothing would draw. */
const MIN_RING_VERTICES = 3

/* -------------------------------------------------------------------------------------------------
 * Source
 * ---------------------------------------------------------------------------------------------- */

/** Repository root, resolved from this file so the script runs from anywhere. */
function repoRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..')
}

/** Reads the source collection from the pinned URL, or from a local path. */
async function readSource(source) {
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source)
    if (!response.ok) {
      throw new Error(`${source} responded ${response.status}`)
    }
    return JSON.parse(await response.text())
  }
  return JSON.parse(await readFile(resolve(repoRoot(), source), 'utf8'))
}

/**
 * The ISO 3166-1 alpha-2 code of one source feature, or `null`.
 *
 * Traps 1 to 3 of the header comment, in the order they have to be applied.
 */
function codeOf(properties) {
  for (const key of ['ISO_A2_EH', 'ISO_A2']) {
    const value = properties[key]
    if (typeof value !== 'string') continue
    const code = value.trim().toUpperCase()
    if (code === NO_CODE || !/^[A-Z]{2}$/.test(code)) continue
    return code
  }
  return null
}

/** Every outer ring of one geometry: a lake is not part of a silhouette. */
function outerRings(geometry) {
  if (geometry === null) return []
  const polygons =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates
        : []
  return polygons.map((polygon) => polygon[0]).filter(Array.isArray)
}

/* -------------------------------------------------------------------------------------------------
 * Simplification
 * ---------------------------------------------------------------------------------------------- */

/** Squared distance from a point to a segment, in degrees². */
function squaredSegmentDistance(point, start, end) {
  let x = start[0]
  let y = start[1]
  let dx = end[0] - x
  let dy = end[1] - y

  if (dx !== 0 || dy !== 0) {
    const along =
      ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy)
    if (along > 1) {
      x = end[0]
      y = end[1]
    } else if (along > 0) {
      x += dx * along
      y += dy * along
    }
  }

  dx = point[0] - x
  dy = point[1] - y
  return dx * dx + dy * dy
}

/**
 * Douglas–Peucker, iteratively so a 40,000-vertex coastline cannot blow the
 * stack, and squared throughout so it never takes a root.
 */
function simplify(ring, toleranceDegrees) {
  if (ring.length < MIN_RING_VERTICES) return ring

  const tolerance = toleranceDegrees * toleranceDegrees
  const keep = new Uint8Array(ring.length)
  keep[0] = 1
  keep[ring.length - 1] = 1

  const stack = [[0, ring.length - 1]]
  while (stack.length > 0) {
    const [first, last] = stack.pop()
    let furthest = -1
    let worst = tolerance
    for (let index = first + 1; index < last; index += 1) {
      const distance = squaredSegmentDistance(
        ring[index],
        ring[first],
        ring[last],
      )
      if (distance > worst) {
        worst = distance
        furthest = index
      }
    }
    if (furthest === -1) continue
    keep[furthest] = 1
    stack.push([first, furthest], [furthest, last])
  }

  return ring.filter((_, index) => keep[index] === 1)
}

/**
 * Snaps a ring onto the integer grid and drops the vertices that land on top of
 * one another, including the duplicate closing vertex GeoJSON requires and the
 * encoding does not.
 */
function quantise(ring) {
  const out = []
  let previousX = null
  let previousY = null

  for (const [lng, lat] of ring) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
    const x = Math.round(Math.min(180, Math.max(-180, lng)) * GRID)
    const y = Math.round(Math.min(90, Math.max(-90, lat)) * GRID)
    if (x === previousX && y === previousY) continue
    out.push([x, y])
    previousX = x
    previousY = y
  }

  const first = out[0]
  const last = out[out.length - 1]
  if (out.length > 1 && first[0] === last[0] && first[1] === last[1]) out.pop()
  return out
}

/**
 * One ring, cut for the asset — or `null` when it encloses nothing at this
 * scale.
 *
 * The retry is what keeps the smallest islands: simplification runs first, and
 * if it has taken the ring below the three distinct vertices a fill needs, the
 * original is quantised instead.
 *
 * Counted over the pinned source rather than guessed: 23 rings across 11 codes
 * take this branch — AU, FJ, IN, KI, MH, NL, NZ, PF, US, VA, VC — and none of
 * them is wider than 0.21°. For nine it is one islet of many: an Ashmore and
 * Cartier islet for Australia, Saba for the Netherlands, Kadmat in the
 * Lakshadweep for India, four barrier islands and keys for the United States.
 * For two the branch is the difference between drawn and absent — Vatican City,
 * whose only ring is 0.012° across, and Tokelau, whose two rings are New
 * Zealand's only land within a degree of the point `UNMAPPED_TERRITORY_CODES`
 * promises TK's coastline at.
 *
 * Nothing in the 1:50m source collapses past the retry, so at this scale the
 * final `null` never fires. It stays because a coarser source would need it.
 */
function cutRing(ring) {
  const simplified = quantise(simplify(ring, TOLERANCE_UNITS / GRID))
  if (simplified.length >= MIN_RING_VERTICES) return simplified
  const whole = quantise(ring)
  return whole.length >= MIN_RING_VERTICES ? whole : null
}

/* -------------------------------------------------------------------------------------------------
 * Ordering
 * ---------------------------------------------------------------------------------------------- */

/** A ring's bounding-box area in grid units², used only to order shapes. */
function ringExtent(ring) {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const [x, y] of ring) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return (maxX - minX) * (maxY - minY)
}

/**
 * Largest country first.
 *
 * Not cosmetic. The asset keeps outer rings only, so South Africa's ring covers
 * Lesotho and Italy's covers San Marino and the Vatican; a fill layer draws
 * later features over earlier ones, and an enclave is by definition smaller
 * than the country around it. Ordering by extent therefore puts every enclave
 * on top of its host without the asset carrying a single hole. Ties break on
 * the code so the ordering is total and the build stays byte-stable.
 */
function byDrawingOrder(a, b) {
  const difference = b.extent - a.extent
  if (difference !== 0) return difference
  return a.code < b.code ? -1 : a.code > b.code ? 1 : 0
}

/* -------------------------------------------------------------------------------------------------
 * Encoding
 * ---------------------------------------------------------------------------------------------- */

/**
 * `ISO:ring;ring|ISO:…`, where a ring is a flat list of delta-encoded grid
 * units, longitude first — the encoding `src/lib/map/world.ts` already decodes,
 * so the finer payload needs no second decoder.
 *
 * Deltas are what make it small: a coastline steps a unit or two at a time, so
 * almost every number is one or two characters and the result gzips to about a
 * third of its size.
 */
function encode(countries) {
  const entries = countries.map(({ code, rings }) => {
    const encodedRings = rings.map((ring) => {
      const deltas = []
      let lastX = 0
      let lastY = 0
      for (const [x, y] of ring) {
        deltas.push(x - lastX, y - lastY)
        lastX = x
        lastY = y
      }
      return deltas.join(',')
    })
    return `${code}:${encodedRings.join(';')}`
  })
  return entries.join('|')
}

/* -------------------------------------------------------------------------------------------------
 * Build
 * ---------------------------------------------------------------------------------------------- */

/** The asset's text, manifest line included, from a parsed source collection. */
function build(collection) {
  if (collection === null || !Array.isArray(collection.features)) {
    throw new Error('source is not a GeoJSON FeatureCollection')
  }

  /** Trap 4: one entry per code, however many source features carry it. */
  const merged = new Map()
  const skipped = []
  for (const feature of collection.features) {
    const properties = feature?.properties ?? {}
    const code = codeOf(properties)
    if (code === null) {
      skipped.push(String(properties.NAME ?? properties.ADMIN ?? 'unnamed'))
      continue
    }
    const rings = merged.get(code) ?? []
    rings.push(...outerRings(feature.geometry))
    merged.set(code, rings)
  }

  const countries = []
  let vertices = 0
  let ringCount = 0
  const empty = []

  for (const [code, rings] of merged) {
    const cut = []
    for (const ring of rings) {
      const drawable = cutRing(ring)
      if (drawable !== null) cut.push(drawable)
    }
    if (cut.length === 0) {
      empty.push(code)
      continue
    }
    // Largest ring first, so a reader and a renderer both meet the mainland
    // before its islands. Ties break on the first vertex, which is stable.
    cut.sort((a, b) => {
      const difference = ringExtent(b) - ringExtent(a)
      if (difference !== 0) return difference
      return a[0][0] - b[0][0] || a[0][1] - b[0][1]
    })
    vertices += cut.reduce((total, ring) => total + ring.length, 0)
    ringCount += cut.length
    countries.push({ code, rings: cut, extent: ringExtent(cut[0]) })
  }

  countries.sort(byDrawingOrder)

  const manifest = [
    `version=${FORMAT_VERSION}`,
    `source=${SOURCE_ID}`,
    `grid=${GRID}`,
    `tolerance=${TOLERANCE_UNITS}`,
    `codes=${countries.length}`,
    `rings=${ringCount}`,
    `vertices=${vertices}`,
  ].join(' ')

  return {
    text: `${manifest}\n${encode(countries)}\n`,
    report: {
      features: collection.features.length,
      skipped,
      empty,
      codes: countries.length,
      rings: ringCount,
      vertices,
    },
  }
}

/* -------------------------------------------------------------------------------------------------
 * Entry point
 * ---------------------------------------------------------------------------------------------- */

function parseArgs(args) {
  const options = { source: SOURCE_URL, out: OUT_PATH, check: false }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--check') options.check = true
    else if (arg === '--source') options.source = args[(index += 1)]
    else if (arg === '--out') options.out = args[(index += 1)]
    else throw new Error(`unknown argument: ${arg}`)
    if (options.source === undefined || options.out === undefined) {
      throw new Error(`${arg} needs a value`)
    }
  }
  return options
}

async function main() {
  const options = parseArgs(argv.slice(2))
  const target = resolve(repoRoot(), options.out)
  const { text, report } = build(await readSource(options.source))

  if (options.check) {
    const current = await readFile(target, 'utf8').catch(() => null)
    if (current === text) {
      stdout.write(
        `${options.out} is up to date (${report.vertices} vertices)\n`,
      )
      return
    }
    stderr.write(
      `${options.out} differs from a fresh build. Run the script without --check.\n`,
    )
    exit(1)
  }

  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, text)

  const bytes = Buffer.byteLength(text)
  stdout.write(
    [
      `wrote ${options.out}`,
      `  source     ${options.source}`,
      `  features   ${report.features} read, ${report.skipped.length} without an ISO code: ${report.skipped.join(', ')}`,
      `  codes      ${report.codes}${report.empty.length > 0 ? ` (${report.empty.length} collapsed: ${report.empty.join(', ')})` : ''}`,
      `  geometry   ${report.rings} rings, ${report.vertices} vertices`,
      `  size       ${bytes} bytes raw`,
      '',
    ].join('\n'),
  )
}

main().catch((error) => {
  stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  exit(1)
})
