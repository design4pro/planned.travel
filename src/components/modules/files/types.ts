/**
 * The shapes the files screen renders.
 *
 * Declared structurally rather than imported from the route's loader payload, so
 * these components depend on the data they need and not on one screen's wire
 * format.
 */

export interface FileData {
  readonly id: string
  readonly filename: string
  readonly contentType: string
  readonly sizeBytes: number
  readonly kind: string
  readonly description: string | null
  readonly uploadedBy: string
  /** ISO instant. */
  readonly createdAt: string
}

export interface FilePerson {
  readonly userId: string
  readonly name: string
}
