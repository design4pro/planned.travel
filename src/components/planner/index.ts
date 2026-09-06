/**
 * The planner rails.
 *
 * The trip planner is one map with two lists floating over it, and this directory
 * is the two lists plus the arithmetic that keeps them honest:
 *
 * ```tsx
 * <DndContext onDragEnd={commit}>
 *   <PlannerRail side="left" label="Itinerary" collapsed={left} onCollapsedChange={setLeft}>
 *     {days.map((day) => <DaySection key={day.dayId} day={day} … />)}
 *   </PlannerRail>
 *   <PlannerRail side="right" label="Places" collapsed={right} onCollapsedChange={setRight}>
 *     <IdeasList rows={filtered} … />
 *   </PlannerRail>
 *   <DragOverlay>{dragging ? <DragPreview row={dragging} /> : null}</DragOverlay>
 * </DndContext>
 * ```
 *
 * Nothing here fetches, and nothing here imports from `src/server` or
 * `src/routes`: the components take view models with every date and duration
 * already formatted, which is what lets the screen own the trip's data and this
 * directory own how a plan reads.
 *
 * The two pure modules are the interesting half. `ordering` answers "what does the
 * board look like after this drag, and what does the server have to be told" as one
 * function, so an optimistic render and its write can never disagree. `selection`
 * holds the map-and-rail cross-highlighting as a reducer, because eight events over
 * three pieces of state is exactly the shape that rots into a pile of `useState`.
 */

/* ------------------------------------------------------------------- logic */
export {
  IDEAS_CONTAINER,
  containerIds,
  containerOf,
  ideaItemId,
  indexOf,
  isIdeaItemId,
  isNoteItemId,
  itemsIn,
  mergeDayTimeline,
  movePlanItem,
  movePlanItemToDay,
  noteIdOfNoteItem,
  noteItemId,
  placeIdOfIdeaItem,
  removePlanItem,
  scheduledCount,
} from './ordering'
export type {
  DayOrder,
  MoveOptions,
  PlaceOfItem,
  PlanChange,
  PlanMoveRefusal,
  PlanMoveResult,
  PlanOrder,
  PlanTarget,
  TimeOfItem,
  TimelineItem,
} from './ordering'

export { emphasisFor, initialSelection, selectionReducer } from './selection'
export type {
  PlannerEmphasis,
  PlannerSelection,
  SelectionAction,
} from './selection'

export { usePlanDnd } from './plan-dnd'
export type { PlanDnd, PlanDndOptions } from './plan-dnd'

/* ------------------------------------------------------------- data shapes */
export { isMapped } from './types'
export type { PlannerCategory, PlannerDay, PlannerRow } from './types'

/* ---------------------------------------------------------------- surfaces */
export { PlannerRail } from './rail'
export type { PlannerRailProps } from './rail'
export { DaySection } from './day-section'
export type { DaySectionProps } from './day-section'
export { IdeasList } from './ideas-list'
export type { IdeasListProps, PlacesScope } from './ideas-list'
export { StopRow } from './stop-row'
export type { StopRowProps } from './stop-row'
export { PlaceThumb } from './place-thumb'
export type { PlaceThumbProps, PlaceThumbSize } from './place-thumb'
export { DragPreview } from './drag-preview'
export type { DragPreviewProps } from './drag-preview'
