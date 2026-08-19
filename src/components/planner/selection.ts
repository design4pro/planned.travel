/**
 * What the reader is pointing at, on either side of the screen.
 *
 * The planner shows the same trip twice — as a list of days and as a set of pins —
 * and the whole value of showing it twice comes from the two halves staying in
 * step. Clicking a pin has to light up its row and scroll the rail to it; hovering
 * a row has to light up its pin and, on a click, ease the camera to it.
 *
 * That is three pieces of state (selected place, hovered place, focused day) and
 * about eight events that touch them, which is precisely the shape that rots into
 * a pile of `useState` calls with subtly different update rules per call site. So
 * it is a reducer, and it is pure, and it is tested — including the rules that are
 * easy to get wrong:
 *
 * - Selecting a place also focuses the day it belongs to, so the map dims the other
 *   days' routes without a second dispatch.
 * - Hover never clears a selection, and a stale `hover-out` for a row the pointer
 *   already left cannot clear the hover belonging to the row it is now on.
 * - Selecting the already-selected place clears it. A pin is a toggle; that is what
 *   makes "click the map background" unnecessary as the only way out.
 * - Every camera move is requested through a monotonic token rather than a
 *   boolean, so two consecutive selections of the same place ease the camera twice
 *   while a re-render never eases it at all.
 */

export interface PlannerSelection {
  /** Place whose pin is ringed and whose row is highlighted. */
  readonly placeId: string | null
  /** Place under the pointer or keyboard focus. Lighter treatment than selection. */
  readonly hoverId: string | null
  /** Day being read. Emphasises one route line and one rail section. */
  readonly dayId: string | null
  /**
   * Increments whenever the camera should move to {@link cameraTarget}. An effect
   * keyed on this number moves the map exactly as often as the reader asked.
   */
  readonly cameraToken: number
  /** Place the camera was last asked to ease to. */
  readonly cameraTarget: string | null
}

export const initialSelection: PlannerSelection = {
  placeId: null,
  hoverId: null,
  dayId: null,
  cameraToken: 0,
  cameraTarget: null,
}

export type SelectionAction =
  /** A pin was clicked. Selects, focuses its day, and does *not* move the camera. */
  | { readonly type: 'pin-click'; readonly placeId: string; readonly dayId: string | null }
  /** A rail row was activated. Selects and eases the camera to it. */
  | { readonly type: 'row-click'; readonly placeId: string; readonly dayId: string | null }
  /** The pointer or keyboard focus entered a row or a pin. */
  | { readonly type: 'hover-in'; readonly placeId: string; readonly dayId?: string | null }
  /** …and left it. Ignored when the pointer has already moved on. */
  | { readonly type: 'hover-out'; readonly placeId: string }
  /** A day header was activated. Focuses the day without selecting a place. */
  | { readonly type: 'focus-day'; readonly dayId: string | null }
  /** Ask the camera to revisit the current selection — the "recentre" button. */
  | { readonly type: 'recentre' }
  /** Clear everything: a click on the map background, or Escape. */
  | { readonly type: 'clear' }
  /** The selected place stopped existing — deleted, or moved out of view. */
  | { readonly type: 'forget'; readonly placeId: string }

export function selectionReducer(
  state: PlannerSelection,
  action: SelectionAction,
): PlannerSelection {
  switch (action.type) {
    case 'pin-click': {
      // A pin is a toggle: clicking the ringed pin again lets go of it.
      if (state.placeId === action.placeId) {
        return { ...state, placeId: null, dayId: null }
      }
      return {
        ...state,
        placeId: action.placeId,
        dayId: action.dayId ?? null,
      }
    }

    case 'row-click': {
      if (state.placeId === action.placeId) {
        // Already selected, so the reader is asking to be taken there again
        // rather than to deselect — a row is not a toggle, its pin is.
        return {
          ...state,
          dayId: action.dayId ?? state.dayId,
          cameraToken: state.cameraToken + 1,
          cameraTarget: action.placeId,
        }
      }
      return {
        ...state,
        placeId: action.placeId,
        dayId: action.dayId ?? null,
        cameraToken: state.cameraToken + 1,
        cameraTarget: action.placeId,
      }
    }

    case 'hover-in': {
      if (state.hoverId === action.placeId) return state
      return {
        ...state,
        hoverId: action.placeId,
        // Hovering inside a day is a weak signal about which day is being read,
        // but only while nothing is actually selected.
        dayId:
          state.placeId === null && action.dayId !== undefined
            ? action.dayId
            : state.dayId,
      }
    }

    case 'hover-out': {
      // Pointer events arrive out of order often enough to matter: a leave for the
      // row the reader has already left must not clear the hover on the row they
      // are now on.
      if (state.hoverId !== action.placeId) return state
      return { ...state, hoverId: null }
    }

    case 'focus-day': {
      if (state.dayId === action.dayId) return state
      return { ...state, dayId: action.dayId }
    }

    case 'recentre': {
      if (state.placeId === null) return state
      return {
        ...state,
        cameraToken: state.cameraToken + 1,
        cameraTarget: state.placeId,
      }
    }

    case 'clear': {
      if (
        state.placeId === null &&
        state.hoverId === null &&
        state.dayId === null
      ) {
        return state
      }
      return { ...state, placeId: null, hoverId: null, dayId: null }
    }

    case 'forget': {
      if (state.placeId !== action.placeId && state.hoverId !== action.placeId) {
        return state
      }
      return {
        ...state,
        placeId: state.placeId === action.placeId ? null : state.placeId,
        hoverId: state.hoverId === action.placeId ? null : state.hoverId,
      }
    }
  }
}

/**
 * How a row or pin should be drawn.
 *
 * One function rather than two comparisons at each of the four call sites, so the
 * rail and the map can never drift into disagreeing about what "active" means.
 */
export type PlannerEmphasis = 'selected' | 'hovered' | 'rest'

export function emphasisFor(
  state: PlannerSelection,
  placeId: string,
): PlannerEmphasis {
  if (state.placeId === placeId) return 'selected'
  if (state.hoverId === placeId) return 'hovered'
  return 'rest'
}
