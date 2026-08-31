/**
 * The shape the transports screen renders.
 *
 * One row is a **transport**, not a leg: the glossary reserves _leg_ for the part
 * of a journey between two consecutive stations, which is `03-S2b`'s to build.
 * What this module renders is the whole movement between two endpoints.
 *
 * Declared structurally rather than imported from the route's loader payload, so
 * these components depend on the data they need and not on one screen's wire
 * format.
 */

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
}
