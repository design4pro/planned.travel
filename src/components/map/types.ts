/**
 * The shapes the map surface accepts.
 *
 * Deliberately structural rather than imported from `src/server/db/types`: the
 * map draws whatever has a coordinate, and a component in `src/components` must
 * not reach into the server layer. A caller maps a `Place` row onto
 * {@link MapPlace} at the boundary, which also keeps the map usable for search
 * results and imported files that are not rows yet.
 */

import type { Clusterable } from '#/lib/map/cluster'

/** A tenant's own taxonomy entry, as stored on the `categories` table. */
export interface MapCategory {
  readonly id: string
  readonly name: string
  readonly slug: string
  /** Hex colour from the tenant's taxonomy. Used for the pin ring and legend dot. */
  readonly colour: string
  /** `lucide-react` icon name in kebab case, e.g. `bed-double`. */
  readonly icon: string
}

/** Anything the map can pin. */
export interface MapPlace extends Clusterable {
  readonly id: string
  readonly name: string
  readonly lng: number
  readonly lat: number
  readonly categoryId?: string | null
  readonly address?: string | null
  readonly city?: string | null
  /** 1–5, as stored. `null` when the place has not been rated. */
  readonly rating?: number | null
  readonly imageUrl?: string | null
  /** Itinerary day, 1-based. Drives the numeral on the pin. */
  readonly dayNumber?: number | null
  readonly isVisited?: boolean
}

/**
 * One country on the traveller's record, as the atlas layer needs it.
 *
 * Deliberately narrower than the row it comes from. The map paints a country and
 * places it on the recency ramp, and both answers come from the code and the
 * *last* visit; the first visit, the count and the note belong to the record the
 * reader opens, not to a polygon. Keeping the shape at two fields is what stops a
 * pointer move rebuilding a payload it never reads.
 *
 * Prefixed `Map`, like {@link MapPlace} and {@link MapCategory} beside it, because
 * `VisitedCountry` is already the name of the D1 row in `src/server/db/types` and
 * an atlas screen legitimately holds both: the rows it loaded and the projection
 * it hands the map. One import, one name, no alias at the call site.
 */
export interface MapVisitedCountry {
  /** ISO 3166-1 alpha-2. Matched case-insensitively against the geometry. */
  readonly countryCode: string
  /** `YYYY-MM-DD`. `null` places the country on the middle stop of the ramp. */
  readonly lastVisitedOn?: string | null
}
