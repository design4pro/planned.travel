import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  decodeOutlines,
  landPath,
  outlineFor,
  ringsToPath,
  worldOutlineCount,
  worldOutlines,
} from '../world'

import type { Projection } from '../world'

/** Plate carrée into a 360×180 box, so a degree is a unit and maths stays readable. */
const identity: Projection = (lng, lat) => [lng + 180, 90 - lat]

describe('worldOutlines', () => {
  it('carries the whole world, keyed by ISO alpha-2', () => {
    const outlines = worldOutlines()
    expect(worldOutlineCount()).toBeGreaterThan(160)
    for (const code of ['JP', 'PT', 'GB', 'US', 'AR', 'AU', 'ZA', 'IS']) {
      expect(outlines.get(code), code).toBeDefined()
    }
    for (const code of outlines.keys()) {
      expect(code).toMatch(/^[A-Z]{2}$/)
    }
  })

  it('decodes once and hands back the same instance', () => {
    expect(worldOutlines()).toBe(worldOutlines())
  })

  it('keeps every vertex inside the coordinate system', () => {
    for (const [code, outline] of worldOutlines()) {
      for (const ring of outline) {
        // Three vertices is the floor for an area; anything less is a stray line.
        expect(ring.length, code).toBeGreaterThanOrEqual(3)
        for (const [lng, lat] of ring) {
          expect(lng, code).toBeGreaterThanOrEqual(-180)
          expect(lng, code).toBeLessThanOrEqual(180)
          expect(lat, code).toBeGreaterThanOrEqual(-90)
          expect(lat, code).toBeLessThanOrEqual(90)
        }
      }
    }
  })

  it('puts each country roughly where it belongs', () => {
    const centre = (code: string) => {
      const rings = outlineFor(code)
      const points = rings.flat()
      const lng = points.reduce((sum, [x]) => sum + x, 0) / points.length
      const lat = points.reduce((sum, [, y]) => sum + y, 0) / points.length
      return { lng, lat }
    }

    const japan = centre('JP')
    expect(japan.lng).toBeGreaterThan(125)
    expect(japan.lng).toBeLessThan(150)
    expect(japan.lat).toBeGreaterThan(24)
    expect(japan.lat).toBeLessThan(46)

    const portugal = centre('PT')
    expect(portugal.lng).toBeLessThan(-6)
    expect(portugal.lat).toBeGreaterThan(36)

    const argentina = centre('AR')
    expect(argentina.lat).toBeLessThan(-20)
  })

  it('keeps an archipelago as separate rings', () => {
    // One ring would mean Honshu and Hokkaido had been joined by a land bridge.
    expect(outlineFor('JP').length).toBeGreaterThan(1)
  })

  it('is case insensitive and empty for a code it does not carry', () => {
    expect(outlineFor('jp')).toBe(outlineFor('JP'))
    expect(outlineFor('ZZ')).toEqual([])
  })
})

describe('ringsToPath', () => {
  it('emits one closed subpath per ring', () => {
    const path = ringsToPath(
      [
        [
          [0, 0],
          [10, 0],
          [10, 10],
        ],
        [
          [20, 20],
          [30, 20],
          [30, 30],
        ],
      ],
      identity,
      0,
    )
    expect(path).toBe('M180 90L190 90L190 80ZM200 70L210 70L210 60Z')
  })

  it('drops a ring that cannot enclose anything', () => {
    expect(
      ringsToPath(
        [
          [
            [0, 0],
            [1, 1],
          ],
        ],
        identity,
        0,
      ),
    ).toBe('')
  })

  it('collapses vertices that quantise onto the same point', () => {
    // Four vertices, three distinct after rounding, so the ring still draws.
    const path = ringsToPath(
      [
        [
          [0, 0],
          [0.1, 0],
          [10, 0],
          [10, 10],
        ],
      ],
      identity,
      0,
    )
    expect(path).toBe('M180 90L190 90L190 80Z')
  })

  it('honours the requested precision', () => {
    const rings = [
      [
        [0.123, 0],
        [10.456, 0],
        [10.456, 10.789],
      ],
    ] as const
    expect(ringsToPath([rings[0]], identity, 2)).toContain('180.12')
    expect(ringsToPath([rings[0]], identity, 0)).toContain('M180 90')
  })
})

describe('landPath', () => {
  it('returns only the geometry that can reach the window', () => {
    const japanWindow = {
      minLng: 128,
      maxLng: 146,
      minLat: 30,
      maxLat: 46,
    }
    const wholeWorld = {
      minLng: -180,
      maxLng: 180,
      minLat: -90,
      maxLat: 90,
    }
    const near = landPath(japanWindow, identity)
    const all = landPath(wholeWorld, identity)

    expect(near.length).toBeGreaterThan(0)
    // Culling has to be a real saving, not a rounding difference.
    expect(near.length).toBeLessThan(all.length / 5)
    expect(all.split('Z').length).toBeGreaterThan(near.split('Z').length)
  })

  it('is empty over open ocean', () => {
    // The South Pacific gyre: no land within thousands of kilometres.
    expect(
      landPath(
        { minLng: -130, maxLng: -125, minLat: -42, maxLat: -38 },
        identity,
      ),
    ).toBe('')
  })
})

describe('decodeOutlines', () => {
  it('walks deltas back into degrees, longitude first', () => {
    // Two rings for one country, the second starting from its own origin.
    const outlines = decodeOutlines('ZZ:0,0,100,0,0,100;500,500,100,0,0,100')
    expect([...outlines.keys()]).toEqual(['ZZ'])

    const [first, second] = outlines.get('ZZ') ?? []
    expect(first).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
    ])
    expect(second).toEqual([
      [5, 5],
      [6, 5],
      [6, 6],
    ])
  })

  it('reads the payload on the grid it is told about', () => {
    // The finer cut states its grid in its own manifest rather than assuming
    // this module's, so a future asset can change it without a second decoder.
    expect(decodeOutlines('ZZ:1,2,3,4', 1).get('ZZ')).toEqual([
      [
        [1, 2],
        [4, 6],
      ],
    ])
    expect(decodeOutlines('ZZ:1,2,3,4', 1000).get('ZZ')).toEqual([
      [
        [0.001, 0.002],
        [0.004, 0.006],
      ],
    ])
  })

  it('skips a malformed entry instead of inventing a country called nothing', () => {
    // One of the two payloads in this encoding arrives over the network.
    const outlines = decodeOutlines('|:1,2|ZZ:0,0,100,0,0,100|')
    expect([...outlines.keys()]).toEqual(['ZZ'])
  })

  it('drops a trailing coordinate rather than reading it as NaN', () => {
    const ring = decodeOutlines('ZZ:0,0,100,0,50').get('ZZ')?.[0] ?? []
    expect(ring).toEqual([
      [0, 0],
      [1, 0],
    ])
  })

  it('is what the bundled cut itself is decoded with', () => {
    // The claim that there is one decoder, not two: re-encoding a country from
    // the bundle and decoding it again lands on the same coordinates.
    const japan = outlineFor('JP')
    const encoded = japan
      .map((ring) => {
        const deltas: Array<number> = []
        let lastLng = 0
        let lastLat = 0
        for (const [lng, lat] of ring) {
          const x = Math.round(lng * 100)
          const y = Math.round(lat * 100)
          deltas.push(x - lastLng, y - lastLat)
          lastLng = x
          lastLat = y
        }
        return deltas.join(',')
      })
      .join(';')
    expect(decodeOutlines(`JP:${encoded}`).get('JP')).toEqual(japan)
  })
})

/* -------------------------------------------------------------------------------------------------
 * The producer of the other payload in this encoding
 * ---------------------------------------------------------------------------------------------- */

/**
 * A source collection built to trip every trap `scripts/build-country-outlines.mjs`
 * documents, and nothing else.
 *
 * Synthetic rather than a slice of Natural Earth, for two reasons. A fixture cut
 * from the real dataset would drift with the pinned tag and would make each
 * assertion a fact about one country rather than about the rule it stands for.
 * And the codes here are drawn from the user-assigned `QM`–`QZ` range, which ISO
 * will never allocate, so nothing in this file can be mistaken for a claim about
 * a real place.
 *
 * The shapes are laid out so the ordering assertion has something to prove:
 * `QN` sits wholly inside `QM`, which is what an enclave does and what the
 * asset's outer-rings-only cut cannot express as a hole.
 */
const SOURCE_FIXTURE = {
  type: 'FeatureCollection',
  features: [
    {
      // Trap 1: `ISO_A2` is the sentinel and `ISO_A2_EH` carries the code. This
      // is France, Norway and Kosovo in the real dataset — read `ISO_A2` first
      // and the asset loses the country whose overseas départements are the
      // reason it exists.
      type: 'Feature',
      properties: { NAME: 'Fixtureland', ISO_A2: '-99', ISO_A2_EH: 'QM' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0],
          ],
        ],
      },
    },
    {
      // Trap 4: a second feature under the same code. Australia is three of
      // these. Emitting one shape per source row would put two shapes on one
      // `feature-state` id.
      type: 'Feature',
      properties: { NAME: 'Fixture Isles', ISO_A2: 'QM' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [40, 40],
            [41, 40],
            [41, 41],
            [40, 41],
            [40, 40],
          ],
        ],
      },
    },
    {
      // The enclave, for the drawing order.
      type: 'Feature',
      properties: { NAME: 'Fixture Enclave', ISO_A2: 'QN' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [4, 4],
            [5, 4],
            [5, 5],
            [4, 5],
            [4, 4],
          ],
        ],
      },
    },
    {
      // A lake, as GeoJSON spells one: the second ring of a polygon is a hole.
      type: 'Feature',
      properties: { NAME: 'Fixture Lakes', ISO_A2: 'QO' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [20, 20],
            [25, 20],
            [25, 25],
            [20, 25],
            [20, 20],
          ],
          [
            [21, 21],
            [22, 21],
            [22, 22],
            [21, 22],
            [21, 21],
          ],
        ],
      },
    },
    {
      // An islet 0.015° across: Douglas–Peucker at 0.02° erases it, and the
      // build's retry keeps it. Vatican City and Tokelau are the two real
      // places that exist on the map only because of this branch.
      type: 'Feature',
      properties: { NAME: 'Fixture Islet', ISO_A2: 'QP' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [60, 0],
            [60.015, 0],
            [60.015, 0.015],
            [60, 0.015],
            [60, 0],
          ],
        ],
      },
    },
    {
      // Trap 2: the sentinel in both columns is never a code.
      type: 'Feature',
      properties: { NAME: 'Fixture Disputed', ISO_A2: '-99', ISO_A2_EH: '-99' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [70, 0],
            [72, 0],
            [72, 2],
            [70, 2],
            [70, 0],
          ],
        ],
      },
    },
    {
      // Trap 3: no ISO column at all. Somaliland, Northern Cyprus and the
      // Siachen Glacier are the three in the pinned release. The atlas keys
      // everything by alpha-2, so an entity ISO assigns nothing is dropped
      // rather than given an invented code.
      type: 'Feature',
      properties: { NAME: 'Fixture Unclaimed' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [80, 0],
            [82, 0],
            [82, 2],
            [80, 2],
            [80, 0],
          ],
        ],
      },
    },
  ],
}

/** The asset's header line, read as the `key=value` pairs it is written as. */
function manifestOf(asset: string): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const token of asset.slice(0, asset.indexOf('\n')).trim().split(/\s+/)) {
    const split = token.indexOf('=')
    if (split > 0) fields[token.slice(0, split)] = token.slice(split + 1)
  }
  return fields
}

/** The codes an asset carries, in the order it carries them. */
function codesOf(asset: string): Array<string> {
  return asset
    .split('\n')[1]
    .split('|')
    .map((entry) => entry.slice(0, entry.indexOf(':')))
}

describe('scripts/build-country-outlines.mjs', { timeout: 15_000 }, () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
  const script = join(root, 'scripts/build-country-outlines.mjs')

  let workspace = ''
  let asset = ''

  /**
   * One build of the fixture, run the way a developer runs the script.
   *
   * Both streams are captured rather than inherited: three of these assertions
   * are about the script *failing*, and a child that writes its diagnostic
   * straight through would put four alarming lines in a passing test run.
   */
  const run = (args: Array<string>) =>
    execFileSync(process.execPath, [script, ...args], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })

  beforeAll(() => {
    workspace = mkdtempSync(join(tmpdir(), 'country-outlines-'))
    const source = join(workspace, 'source.geojson')
    writeFileSync(source, JSON.stringify(SOURCE_FIXTURE))
    run(['--source', source, '--out', join(workspace, 'first.txt')])
    asset = readFileSync(join(workspace, 'first.txt'), 'utf8')
  })

  afterAll(() => {
    if (workspace !== '') rmSync(workspace, { recursive: true, force: true })
  })

  it('reads ISO_A2_EH before ISO_A2, so the sentinel loses no country', () => {
    // `Fixtureland` carries '-99' in the column a naive reader reaches for.
    expect(codesOf(asset)).toContain('QM')
  })

  it('drops the sentinel, and every entity ISO assigns no code', () => {
    expect(codesOf(asset)).toEqual(['QM', 'QO', 'QN', 'QP'])
    expect(asset).not.toContain('Disputed')
    expect(asset).not.toContain('Unclaimed')
  })

  it('merges by code, so no two shapes share a feature-state id', () => {
    const codes = codesOf(asset)
    expect(new Set(codes).size).toBe(codes.length)

    // Both `Fixtureland` and `Fixture Isles` are inside the one QM entry.
    const outlines = decodeOutlines(
      asset.split('\n')[1],
      Number(manifestOf(asset).grid),
    )
    expect(outlines.get('QM')?.length).toBe(2)
  })

  it('keeps outer rings only, because a lake is not part of a silhouette', () => {
    const outlines = decodeOutlines(
      asset.split('\n')[1],
      Number(manifestOf(asset).grid),
    )
    const lakes = outlines.get('QO') ?? []
    expect(lakes.length).toBe(1)
    expect(lakes[0]).toEqual([
      [20, 20],
      [25, 20],
      [25, 25],
      [20, 25],
    ])
  })

  it('keeps an islet simplification would erase', () => {
    // Simplifying at 0.02° takes this ring below the three vertices a fill
    // needs; the build retries it unsimplified rather than dropping the island.
    const outlines = decodeOutlines(
      asset.split('\n')[1],
      Number(manifestOf(asset).grid),
    )
    expect(outlines.get('QP')?.[0].length).toBeGreaterThanOrEqual(3)
  })

  it('draws every country after anything that could swallow it', () => {
    // Outer rings only, so the enclave has to be painted over its host rather
    // than punched out of it, and a fill layer draws later features on top.
    const codes = codesOf(asset)
    expect(codes.indexOf('QN')).toBeGreaterThan(codes.indexOf('QM'))
  })

  it('states a manifest the decoder can be held to', () => {
    const manifest = manifestOf(asset)
    expect(manifest.version).toBe('1')
    expect(manifest.source).toBe('natural-earth-50m')
    expect(manifest.grid).toBe('100')

    const outlines = decodeOutlines(asset.split('\n')[1], Number(manifest.grid))
    let rings = 0
    let vertices = 0
    for (const outline of outlines.values()) {
      for (const ring of outline) {
        rings += 1
        vertices += ring.length
      }
    }
    expect(String(outlines.size)).toBe(manifest.codes)
    expect(String(rings)).toBe(manifest.rings)
    expect(String(vertices)).toBe(manifest.vertices)
  })

  it('produces a byte-identical asset on a second run', () => {
    // The asset is committed, so a build whose output moved with its ordering,
    // its hash-table iteration or a clock would show up as a diff nobody wrote.
    const second = join(workspace, 'second.txt')
    run(['--source', join(workspace, 'source.geojson'), '--out', second])
    expect(readFileSync(second, 'utf8')).toBe(asset)
  })

  it('passes --check against its own output and fails against a stale one', () => {
    const source = join(workspace, 'source.geojson')
    const target = join(workspace, 'checked.txt')
    run(['--source', source, '--out', target])
    expect(run(['--source', source, '--out', target, '--check'])).toContain(
      'up to date',
    )

    writeFileSync(target, asset.replace('QM', 'QZ'))
    expect(() =>
      run(['--source', source, '--out', target, '--check']),
    ).toThrow()
  })

  it('refuses a source that is not a feature collection', () => {
    const broken = join(workspace, 'broken.json')
    writeFileSync(broken, JSON.stringify({ type: 'Feature' }))
    expect(() =>
      run(['--source', broken, '--out', join(workspace, 'broken.txt')]),
    ).toThrow()
  })

  it('names another scale honestly when it is asked to measure one', () => {
    // The 1:10m cut is rejected in `../countries` on measured bytes, and
    // measuring it means running this script over a source the shipped asset is
    // not cut from. Without `--source-id` that build would write a manifest
    // naming the pinned dataset, so the file used to argue the rejection would
    // itself be mislabelled.
    const source = join(workspace, 'source.geojson')
    const target = join(workspace, 'renamed.txt')
    run(['--source', source, '--source-id', 'fixture-scale', '--out', target])
    expect(manifestOf(readFileSync(target, 'utf8')).source).toBe(
      'fixture-scale',
    )

    // Only the token moves: a rename is not allowed to change the geometry.
    expect(readFileSync(target, 'utf8').split('\n')[1]).toBe(
      asset.split('\n')[1],
    )
  })

  it('refuses a provenance token the manifest line cannot carry', () => {
    // The manifest is space-separated `key=value` pairs, so a token with a space
    // in it would decode as extra fields rather than as a name.
    const source = join(workspace, 'source.geojson')
    expect(() =>
      run([
        '--source',
        source,
        '--source-id',
        'fixture scale',
        '--out',
        join(workspace, 'rejected.txt'),
      ]),
    ).toThrow()
  })

  it('refuses an argument it does not understand', () => {
    expect(() => run(['--tolerance', '4'])).toThrow()
    expect(() => run(['--source'])).toThrow()
    expect(() => run(['--source-id'])).toThrow()
  })
})
