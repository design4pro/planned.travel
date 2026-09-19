/**
 * The geocoder's credits, as data both halves of the product read.
 *
 * `src/server/geo/geoapify.ts` declares them as its vendor's attribution, which the
 * proxy returns beside every answer; `MapAttribution` renders them on the map. One
 * constant in a client-safe module is what keeps the server's obligation and the
 * surface that discharges it (ADR 0013) from drifting apart. Proper nouns and URLs
 * only — the sentence around them is catalogue copy.
 */

export interface GeoCredit {
  /** As the licence spells it: `'OpenStreetMap'`, `'Geoapify'`. */
  readonly name: string
  readonly url: string
}

export const GEOAPIFY_CREDITS: ReadonlyArray<GeoCredit> = [
  { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/copyright' },
  { name: 'Geoapify', url: 'https://www.geoapify.com/' },
]
