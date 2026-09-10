import * as React from 'react'
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

import { useKeyboardCodeFallback } from '#/lib/dnd-keyboard'

import { IDEAS_CONTAINER, containerOf, itemsIn } from './ordering'

import type {
  Announcements,
  DragEndEvent,
  DragStartEvent,
  KeyboardSensorOptions,
  Over,
  PointerSensorOptions,
  ScreenReaderInstructions,
  SensorDescriptor,
  SensorOptions,
} from '@dnd-kit/core'
import type { PlanOrder, PlanTarget } from './ordering'
import type { PlannerDay, PlannerNote, PlannerRow } from './types'

/**
 * Six pixels: enough that a tap to select never starts a drag, small enough that a
 * deliberate drag feels immediate. Declared at module scope because `useSensor`
 * memoises on the options object, and a fresh literal every render would hand
 * `DndContext` a new sensor array on every keystroke.
 */
const POINTER_OPTIONS: PointerSensorOptions = {
  activationConstraint: { distance: 6 },
}

const KEYBOARD_OPTIONS: KeyboardSensorOptions = {
  coordinateGetter: sortableKeyboardCoordinates,
}

/**
 * What a screen reader is told before it ever presses anything.
 *
 * `@dnd-kit`'s default text talks about "a draggable item" and "droppable areas".
 * This board's droppable areas are *days*, and a reader who has just heard "Sensō-ji,
 * reorder, sortable" needs to know that the arrow keys walk days rather than pixels.
 */
const INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    'To move a stop with the keyboard, focus its reorder handle and press space ' +
    'or enter. The arrow keys then move the stop up and down the itinerary and ' +
    'across days; space or enter drops it on the day it is over, and escape ' +
    'puts it back where it was.',
}

export interface PlanDndOptions {
  /** The board as the reader currently sees it, optimistic moves included. */
  readonly order: PlanOrder
  readonly rowsByItem: ReadonlyMap<string, PlannerRow>
  /** Notes by draggable id, so a note can be named out loud like a stop. */
  readonly notesByItem?: ReadonlyMap<string, PlannerNote>
  /** Days, for naming a drop target out loud. */
  readonly days: ReadonlyArray<PlannerDay>
  /**
   * Called once a drag resolves to a real destination.
   *
   * Returns the sentence to announce when the move was refused, or `null` when it
   * was accepted. The refusal vocabulary — and the catalogue it is translated from —
   * belongs to the screen; this hook only has to say what the screen decided, because
   * otherwise a refused keyboard drag is silence and the reader is left guessing.
   */
  readonly onMove: (itemId: string, target: PlanTarget) => string | null
}

export interface PlanDnd {
  /**
   * Mutable rather than `ReadonlyArray` because that is the array type
   * `DndContext` accepts, and narrowing it here would only force a cast there.
   */
  readonly sensors: Array<SensorDescriptor<SensorOptions>>
  readonly announcements: Announcements
  readonly screenReaderInstructions: ScreenReaderInstructions
  /** The row being dragged, for the drag overlay. `null` when nothing is. */
  readonly draggingId: string | null
  readonly onDragStart: (event: DragStartEvent) => void
  readonly onDragEnd: (event: DragEndEvent) => void
  readonly onDragCancel: () => void
}

/**
 * Everything `DndContext` needs to run the planner board, keyboard included.
 *
 * Extracted from the screen for one reason: a keyboard drag is four events and two
 * announcements deep, and none of it can be tested through a component that also
 * needs a map, a router and a trip. Here it is one hook over a view model, so
 * "space, arrow-down, arrow-down, space moves the stop to the next day and says so"
 * is an assertion rather than a hope.
 */
export function usePlanDnd({
  order,
  rowsByItem,
  notesByItem,
  days,
  onMove,
}: PlanDndOptions): PlanDnd {
  const [draggingId, setDraggingId] = React.useState<string | null>(null)

  useKeyboardCodeFallback()

  const sensors = useSensors(
    useSensor(PointerSensor, POINTER_OPTIONS),
    useSensor(KeyboardSensor, KEYBOARD_OPTIONS),
  )

  const targetOf = React.useCallback(
    (over: Over | null): PlanTarget | null => {
      if (over === null) return null
      const overId = String(over.id)

      // Dropped on a row: take its position, and let `movePlanItem` splice.
      const container = containerOf(order, overId)
      if (container !== null) {
        const items = itemsIn(order, container) ?? []
        return { container, index: Math.max(0, items.indexOf(overId)) }
      }

      // Dropped on a container itself — an empty day, or the gap under a list.
      const items = itemsIn(order, overId)
      return items === null ? null : { container: overId, index: items.length }
    },
    [order],
  )

  /**
   * Name of an item, for anything spoken rather than drawn.
   *
   * A note has no name of its own, so its headline stands in — the same words the
   * reader sees on the row, which is what makes "Moved Buy the metro pass to Day 2"
   * comprehensible without a second lookup.
   */
  const nameOfItem = React.useCallback(
    (itemId: string): string =>
      rowsByItem.get(itemId)?.name ??
      notesByItem?.get(itemId)?.body ??
      'the stop',
    [notesByItem, rowsByItem],
  )

  /** Name of a container: a numbered, titled day, or the ideas column. */
  const nameOfContainer = React.useCallback(
    (container: string | null): string => {
      if (container === null) return 'the board'
      if (container === IDEAS_CONTAINER) return 'Ideas'
      const day = days.find((entry) => entry.dayId === container)
      return day === undefined
        ? 'the board'
        : `Day ${day.dayNumber} — ${day.title}`
    },
    [days],
  )

  /**
   * Name of whatever the drag is currently over.
   *
   * A drag is over a *row* most of the time, and over a *container* whenever it is
   * over an empty day or the gap under a list — which is the case a keyboard drag
   * hits constantly, because the arrow keys walk droppables rather than rows. So
   * both have to resolve to a day name; asking only "which container holds this
   * row?" answered "the board" for every empty day on the trip.
   */
  const nameOfOver = React.useCallback(
    (overId: string): string =>
      nameOfContainer(
        containerOf(order, overId) ??
          (itemsIn(order, overId) === null ? null : overId),
      ),
    [nameOfContainer, order],
  )

  /**
   * Where the drag was resolved to, captured while `order` still describes the
   * board the reader lifted from.
   *
   * `@dnd-kit` runs its announcement callbacks from an effect, which is *after*
   * `onDragEnd` has already applied the optimistic order — so an announcement that
   * asked "which container holds `over.id`?" at that point answered against the
   * board after the move and named the wrong day. Resolving it here, from the very
   * same `targetOf` the commit uses, is the only version that can agree with what
   * actually happened.
   */
  const spokenRef = React.useRef<{
    from: string
    to: string
    refusal: string | null
  }>({ from: 'the board', to: 'the board', refusal: null })

  const onDragStart = React.useCallback(
    (event: DragStartEvent): void => {
      const id = String(event.active.id)
      setDraggingId(id)
      spokenRef.current = {
        from: nameOfContainer(containerOf(order, id)),
        to: 'the board',
        refusal: null,
      }
    },
    [nameOfContainer, order],
  )

  const onDragEnd = React.useCallback(
    (event: DragEndEvent): void => {
      setDraggingId(null)
      const target = targetOf(event.over)
      spokenRef.current = {
        ...spokenRef.current,
        to: target === null ? '' : nameOfContainer(target.container),
        refusal: null,
      }
      if (target === null) return
      spokenRef.current.refusal = onMove(String(event.active.id), target)
    },
    [nameOfContainer, onMove, targetOf],
  )

  const onDragCancel = React.useCallback((): void => {
    setDraggingId(null)
  }, [])

  /**
   * What a screen reader hears during a keyboard drag.
   *
   * Without this `@dnd-kit` falls back to its own strings, which name the
   * *identifiers* it was given — "Draggable item 0mszuwpx… was moved over
   * droppable area 0mszuwpy…". Every id on this board is a nanoid, so the default
   * announcement is the one part of the planner a sighted reader never sees and a
   * blind reader cannot use. Naming the stop and the day it landed on is the whole
   * point of a board that can be driven from the keyboard at all.
   */
  const announcements = React.useMemo<Announcements>(
    () => ({
      onDragStart: ({ active }) =>
        `Picked up ${nameOfItem(String(active.id))}, on ${spokenRef.current.from}. Arrow keys move it, space drops it, escape cancels.`,
      // Being over the row you have only just picked up is not news, and saying it
      // is actively harmful: `@dnd-kit` measures its droppables the moment a lift
      // happens, which produces an `onDragOver` in the same commit as the
      // `onDragStart`. A live region that changes twice in one commit is spoken
      // once, so announcing it would silence "Picked up Sensō-ji" — the one
      // sentence that tells the reader the drag began at all.
      onDragOver: ({ active, over }) =>
        over === null || over.id === active.id
          ? undefined
          : `Now over ${nameOfOver(String(over.id))}.`,
      // A refused drop is the one outcome a sighted reader gets for free — the row
      // visibly snaps back — and a keyboard reader gets nothing at all. So the
      // screen's own sentence wins over the generic one whenever there is one.
      onDragEnd: ({ active }) =>
        spokenRef.current.refusal ??
        (spokenRef.current.to === ''
          ? `${nameOfItem(String(active.id))} was left where it was.`
          : `Moved ${nameOfItem(String(active.id))} to ${spokenRef.current.to}. Saving.`),
      onDragCancel: ({ active }) =>
        `Cancelled. ${nameOfItem(String(active.id))} is back on ${spokenRef.current.from}.`,
    }),
    [nameOfItem, nameOfOver],
  )

  return {
    sensors,
    announcements,
    screenReaderInstructions: INSTRUCTIONS,
    draggingId,
    onDragStart,
    onDragEnd,
    onDragCancel,
  }
}
