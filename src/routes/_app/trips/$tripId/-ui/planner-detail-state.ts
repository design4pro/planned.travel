/** Detail visibility is independent of the map's hover and camera selection. */
export type PlannerDetailState =
  | { readonly kind: 'closed' }
  | {
      readonly kind: 'day'
      readonly dayId: string
      readonly minimised: boolean
    }
  | { readonly kind: 'place'; readonly placeId: string }

export type PlannerDetailAction =
  | { readonly type: 'day'; readonly dayId: string }
  | { readonly type: 'place'; readonly placeId: string }
  | { readonly type: 'minimise' }
  | { readonly type: 'expand' }
  | { readonly type: 'close' }

export function plannerDetailReducer(
  state: PlannerDetailState,
  action: PlannerDetailAction,
): PlannerDetailState {
  switch (action.type) {
    case 'day':
      return { kind: 'day', dayId: action.dayId, minimised: false }
    case 'place':
      return { kind: 'place', placeId: action.placeId }
    case 'close':
      return { kind: 'closed' }
    case 'minimise':
      return state.kind === 'day' ? { ...state, minimised: true } : state
    case 'expand':
      return state.kind === 'day' ? { ...state, minimised: false } : state
  }
}
