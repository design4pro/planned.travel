/**
 * The credits the product owes its vendors, as data both halves of it read.
 *
 * `src/server/geo/geoapify.ts` declares the geocoder's as its vendor's attribution, which the
 * proxy returns beside every answer; `MapAttribution` renders them on the map. One
 * constant in a client-safe module is what keeps the server's obligation and the
 * surface that discharges it (ADR 0013) from drifting apart. Proper nouns and URLs
 * only — the sentence around them is catalogue copy. HERE's (ADR 0011, ADR 0019) is read by
 * the client surfaces alone.
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

/**
 * HERE, credited on every surface that shows an answer it routed (ADR 0019): the connection search
 * today, the road line on the map. The two share this one constant. HERE's General
 * Content Supplier Terms and Notices prescribe no wording for the credit itself, only that the
 * End-User be told of the supplier terms and source attributions "in a reasonably conspicuous
 * manner", so this names the vendor and links its site; the supplier notices belong to the
 * product's terms, which a person owns.
 */
export const HERE_CREDITS: ReadonlyArray<GeoCredit> = [
  { name: 'HERE', url: 'https://www.here.com/' },
]
