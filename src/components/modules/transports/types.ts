/**
 * The shape the transports screen renders.
 *
 * One row is a **transport** and the part of it between two consecutive stations
 * is a **leg** — the glossary's words, and now the code's. A transport is the
 * whole movement; a transport with three stations is a chain of two legs.
 *
 * Declared structurally rather than imported from the route's loader payload, so
 * these components depend on the data they need and not on one screen's wire
 * format.
 */

/**
 * One leg: where it starts, where it ends, and the three facts a person reads at
 * a desk.
 *
 * Each endpoint states **its own IANA zone**, because a time here is a wall clock
 * at the place it applies to and is never converted on the way in. Without the
 * zone a departure written in Tokyo reads as a departure in whatever zone the
 * reader happens to be sitting in, which is wrong by up to a day and says nothing
 * to warn them.
 */
export interface TransportLegData {
  readonly id: string
  /** 0-based index in the chain. */
  readonly position: number
  readonly fromName: string
  readonly fromCode: string | null
  readonly fromLat: number | null
  readonly fromLng: number | null
  readonly fromTimezone: string | null
  readonly toName: string
  readonly toCode: string | null
  readonly toLat: number | null
  readonly toLng: number | null
  readonly toTimezone: string | null
  readonly serviceNumber: string | null
  readonly platform: string | null
  readonly seat: string | null
  readonly departureDayId: string | null
  readonly arrivalDayId: string | null
  readonly departureDate: string | null
  readonly departureTime: string | null
  readonly arrivalDate: string | null
  readonly arrivalTime: string | null
}

export interface TransportData {
  readonly id: string
  readonly mode: string
  readonly status: string
  readonly title: string
  readonly carrier: string | null
  readonly serviceNumber: string | null
  readonly bookingCode: string | null
  readonly seat: string | null
  /**
   * The itinerary day it leaves on and the day it lands on. Either may be unset,
   * and the second is never derived from the first — a night flight lands on the
   * day after the one it left on, and only the traveller knows that.
   */
  readonly departureDayId: string | null
  readonly arrivalDayId: string | null
  readonly departureName: string | null
  readonly departureCode: string | null
  readonly departureDate: string | null
  readonly departureTime: string | null
  readonly arrivalName: string | null
  readonly arrivalCode: string | null
  readonly arrivalDate: string | null
  readonly arrivalTime: string | null
  readonly distanceMetres: number | null
  readonly priceMinor: number | null
  readonly currency: string | null
  readonly notes: string | null
  /**
   * The chain, in order, or empty for a journey nobody broke into legs.
   *
   * Empty is the normal case and not a missing read: nothing was backfilled, so
   * every transport recorded before chains existed carries no rows here and is
   * rendered from the flat endpoints above — which is exactly what it looked like
   * before, and is why the migration needed none.
   */
  readonly legs: ReadonlyArray<TransportLegData>
}

/**
 * A day of the trip, as the two day selects offer it and a day chip reads it.
 *
 * The loader's own `TransportDayOption` is this shape; it is restated here for
 * the reason above, so the dialog and the timeline depend on the four fields
 * they use rather than on the payload that happens to carry them.
 */
export interface TransportDayData {
  readonly id: string
  readonly dayNumber: number
  readonly date: string | null
  readonly title: string | null
}
