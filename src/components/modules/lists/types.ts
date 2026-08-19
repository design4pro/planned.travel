/**
 * The shapes the lists screen renders.
 *
 * Declared structurally rather than imported from the route's loader payload, so
 * these components depend on the *data they need* and not on one screen's wire
 * format. The route passes its loader data straight in; TypeScript checks the fit
 * at that boundary.
 */

export interface PersonOption {
  readonly userId: string
  readonly name: string
  readonly image: string | null
}

export interface ListItemData {
  readonly id: string
  readonly name: string
  readonly category: string | null
  readonly quantity: number
  readonly weightGrams: number | null
  readonly isDone: boolean
  readonly assignedTo: string | null
  readonly priority: string
}

export interface ListData {
  readonly id: string
  readonly name: string
  readonly kind: string
  readonly colour: string | null
  readonly ownerUserId: string | null
  readonly weightLimitGrams: number | null
  readonly items: ReadonlyArray<ListItemData>
}
