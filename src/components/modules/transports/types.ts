/**
 * The shape the transports screen renders.
 *
 * Declared structurally rather than imported from the route's loader payload, so
 * these components depend on the data they need and not on one screen's wire
 * format.
 */

export interface LegData {
  readonly id: string
  readonly mode: string
  readonly status: string
  readonly title: string
  readonly carrier: string | null
  readonly serviceNumber: string | null
  readonly bookingCode: string | null
  readonly seat: string | null
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
