/**
 * A synthetic PMTiles v3 header, for tests that need the probe to succeed.
 *
 * Shared rather than duplicated because two suites depend on the same 127 bytes:
 * the probe's own tests here, and `MapCanvas`, which decides between three styles
 * from what the header says. Written with a `DataView` at the spec's own offsets,
 * so a fixture can never drift from the parser by accident — if the layout is
 * wrong, both sides are wrong together and the round-trip test catches it.
 */

import { PMTILES_HEADER_LENGTH, PMTILES_TILE_TYPE_MVT } from '../coverage'

export interface ArchiveFixtureOptions {
  /** Defaults to 3, the version the parser accepts. */
  readonly specVersion?: number
  /** Defaults to MVT. Anything else must be rejected as unsupported. */
  readonly tileType?: number
  readonly minZoom?: number
  readonly maxZoom?: number
  /** `[west, south, east, north]`. Defaults to the whole world. */
  readonly bounds?: readonly [number, number, number, number]
  readonly center?: readonly [number, number]
  readonly centerZoom?: number
  /** Truncates the buffer, as a half-finished upload would. */
  readonly length?: number
}

/** The Tokyo–Kyoto corridor our own archive is cut to. */
export const REGIONAL_BOUNDS: readonly [number, number, number, number] = [
  134.2, 33.6, 140.9, 36.8,
]

const E7 = 10_000_000

/** Bytes of a v3 header describing whatever the options ask for. */
export function pmtilesHeaderBytes(
  options: ArchiveFixtureOptions = {},
): ArrayBuffer {
  const buffer = new ArrayBuffer(options.length ?? PMTILES_HEADER_LENGTH)
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)

  // "PMTiles" — the magic every archive starts with.
  bytes.set([0x50, 0x4d, 0x54, 0x69, 0x6c, 0x65, 0x73], 0)
  if (bytes.length <= 7) return buffer

  const [west, south, east, north] = options.bounds ?? [-180, -85, 180, 85]
  const [centerLon, centerLat] = options.center ?? [
    (west + east) / 2,
    (south + north) / 2,
  ]

  view.setUint8(7, options.specVersion ?? 3)
  if (bytes.length < PMTILES_HEADER_LENGTH) return buffer

  view.setUint8(99, options.tileType ?? PMTILES_TILE_TYPE_MVT)
  view.setUint8(100, options.minZoom ?? 0)
  view.setUint8(101, options.maxZoom ?? 14)
  view.setInt32(102, Math.round(west * E7), true)
  view.setInt32(106, Math.round(south * E7), true)
  view.setInt32(110, Math.round(east * E7), true)
  view.setInt32(114, Math.round(north * E7), true)
  view.setUint8(118, options.centerZoom ?? 0)
  view.setInt32(119, Math.round(centerLon * E7), true)
  view.setInt32(123, Math.round(centerLat * E7), true)

  return buffer
}
