import * as React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Clock, GripVertical, MapPinOff, Star } from 'lucide-react'

import { cn } from '#/lib/cn'
import { Badge, focusRing, transitionBase } from '#/components/ui'
import { PlaceThumb } from './place-thumb'

import type { BadgeTone } from '#/components/ui'
import type { PlannerCategory, PlannerRow } from './types'

/** A category colour arrives as data, so it travels as a custom property. */
type RowVars = React.CSSProperties & Record<'--row-accent', string>

/**
 * Reservation states worth a badge.
 *
 * Partial on purpose: `none` is the resting state and earns no badge at all, so a
 * lookup genuinely can come back empty and the type has to say so.
 */
const RESERVATION_TONE: Partial<Record<string, BadgeTone>> = {
  confirmed: 'success',
  pending: 'warning',
  cancelled: 'danger',
  requested: 'info',
}

const RESERVATION_LABEL: Partial<Record<string, string>> = {
  confirmed: 'Booked',
  pending: 'To book',
  cancelled: 'Cancelled',
  requested: 'Requested',
}

export interface StopRowProps {
  readonly row: PlannerRow
  readonly category?: PlannerCategory
  /** Position within its day, 1-based. `null` in the ideas column. */
  readonly position: number | null
  /**
   * What the numeral on the thumbnail means. The itinerary counts stops within a
   * day; the places index badges each row with the day it belongs to instead, and
   * a screen reader has to hear the difference rather than "stop 3, day 3".
   */
  readonly positionKind?: 'stop' | 'day'
  /**
   * Overrides the id this row registers with `@dnd-kit` under.
   *
   * `@dnd-kit` keys its draggable registry by id, so two rows sharing one id
   * overwrite each other's node and activator — which is exactly what the places
   * index does when it lists a stop the itinerary is already showing. A row that
   * cannot be dragged (the index's scheduled entries) takes a namespaced id so it
   * stops shadowing the real, draggable one in the day list.
   */
  readonly sortableId?: string
  readonly selected?: boolean
  readonly hovered?: boolean
  /** Greys the row and disables its controls while a write is in flight. */
  readonly pending?: boolean
  /** `false` renders the row without a drag handle — a read-only trip. */
  readonly draggable?: boolean
  readonly onSelect?: () => void
  readonly onHoverChange?: (hovering: boolean) => void
  /** The row's own menu. Rendered at the trailing edge, revealed on hover or focus. */
  readonly actions?: React.ReactNode
}

/**
 * One place in a rail.
 *
 * Four things the reference row does not do, each of which is a question a planner
 * gets asked constantly:
 *
 * - It carries a picture on **every** row — a photograph where there is one, a
 *   category wash and a generated contour where there is not — so the list never
 *   degrades into grey text.
 * - It is a real `<button>` wrapping the picture and the type, so selecting a stop
 *   is one tab stop and one Enter, and the accessible name carries the day, the
 *   time and the address rather than just the name.
 * - The drag handle is its own control with its own name, which is what gives the
 *   whole board keyboard drag-and-drop for free through `@dnd-kit`'s keyboard
 *   sensor. A row that can only be moved with a pointer is a row half the readers
 *   cannot move.
 * - An unmapped place says so, because "why is this not on the map" is otherwise
 *   unanswerable from the rail.
 */
export function StopRow({
  row,
  category,
  position,
  positionKind = 'stop',
  sortableId,
  selected = false,
  hovered = false,
  pending = false,
  draggable = true,
  onSelect,
  onHoverChange,
  actions,
}: StopRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId ?? row.itemId, disabled: !draggable || pending })

  const vars: RowVars = {
    '--row-accent': category?.colour ?? 'var(--color-brand)',
  }

  const tone = RESERVATION_TONE[row.reservationStatus]
  const label = RESERVATION_LABEL[row.reservationStatus]
  const unmapped = row.lng === null || row.lat === null

  // Everything the row shows, folded into one string. A screen reader hears the
  // stop once and completely, instead of hearing "Sensō-ji, button" and having to
  // explore the row to find out when it is.
  const description = [
    row.name,
    category?.name,
    position === null || positionKind === 'day'
      ? null
      : `stop ${position}`,
    row.dayNumber === null ? 'not scheduled' : `day ${row.dayNumber}`,
    row.time,
    row.duration,
    row.location,
    typeof row.rating === 'number' ? `rated ${row.rating} out of 5` : null,
    label,
    unmapped ? 'no map position' : null,
  ]
    .filter((part) => typeof part === 'string' && part !== '')
    .join(', ')

  return (
    <li
      ref={setNodeRef}
      style={{
        ...vars,
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      onPointerEnter={() => onHoverChange?.(true)}
      onPointerLeave={() => onHoverChange?.(false)}
      onFocus={() => onHoverChange?.(true)}
      onBlur={() => onHoverChange?.(false)}
      className={cn(
        'group/row relative flex items-stretch gap-1 rounded-lg pr-1',
        transitionBase,
        // A left rule in the category colour is the cheapest way to make a list of
        // twelve stops legible as three kinds of stop.
        'before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full',
        'before:bg-(--row-accent) before:transition-opacity before:duration-fast',
        selected ? 'before:opacity-100' : 'before:opacity-0',
        selected && 'bg-brand-subtle',
        !selected && hovered && 'bg-hover',
        isDragging && 'z-10 opacity-40',
        pending && 'opacity-60',
      )}
      // Queried by the screen to scroll a row into view when its pin is clicked,
      // which is cheaper and less brittle than a ref registry keyed by row id.
      data-planner-item={row.itemId}
      data-planner-place={row.placeId}
      data-selected={selected ? '' : undefined}
    >
      {draggable ? (
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label={`Reorder ${row.name}`}
          // Not `disabled`: a disabled button cannot hold focus, so a keyboard
          // drop — which leaves the row pending while its write is in the air —
          // would drop the reader's focus with it, back to the top of the
          // document. `aria-disabled` comes from `@dnd-kit`'s own attributes and
          // says the same thing to a screen reader, and the sensor refuses to lift
          // a disabled sortable anyway, so the handle is inert without going away.
          className={cn(
            'grid w-5 shrink-0 cursor-grab place-items-center rounded-sm text-ink-4',
            // Visible whenever it holds focus, not only when the browser decides
            // the focus is "visible": a handle that has focus and cannot be seen
            // is a drag the reader is holding without knowing it.
            'opacity-0 group-hover/row:opacity-100 focus:opacity-100',
            'hover:text-ink-2 active:cursor-grabbing',
            'aria-disabled:cursor-default aria-disabled:text-ink-4',
            transitionBase,
            focusRing,
          )}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} strokeWidth={2} aria-hidden="true" />
        </button>
      ) : (
        <span className="w-1 shrink-0" />
      )}

      <button
        type="button"
        onClick={onSelect}
        aria-label={description}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'flex min-w-0 flex-1 items-start gap-2.5 rounded-md py-2 text-left',
          focusRing,
        )}
      >
        <span className="relative shrink-0">
          <PlaceThumb
            placeId={row.placeId}
            imageUrl={row.imageUrl}
            icon={category?.icon}
            colour={category?.colour}
          />
          {position === null ? null : (
            <span
              aria-hidden="true"
              className={cn(
                'absolute -top-1 -left-1 grid size-4 place-items-center rounded-full',
                'font-display text-micro font-bold tabular-nums ring-2 ring-glass',
                selected
                  ? 'bg-brand text-brand-on'
                  : 'bg-accent text-accent-on',
              )}
            >
              {position}
            </span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-label font-semibold text-ink">
              {row.name}
            </span>
            {row.time === null ? null : (
              <span className="shrink-0 text-caption font-medium tabular-nums text-ink-2">
                {row.time}
              </span>
            )}
          </span>

          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-caption text-ink-3">
            {unmapped ? (
              <MapPinOff
                size={11}
                strokeWidth={2}
                aria-hidden="true"
                className="shrink-0 text-warning"
              />
            ) : null}
            <span className="min-w-0 truncate">
              {row.location ?? (unmapped ? 'No map position yet' : 'Position set')}
            </span>
          </span>

          {row.duration === null &&
          typeof row.rating !== 'number' &&
          tone === undefined ? null : (
            <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {row.duration === null ? null : (
                <span className="inline-flex items-center gap-1 text-caption tabular-nums text-ink-3">
                  <Clock size={11} strokeWidth={2} aria-hidden="true" />
                  {row.duration}
                </span>
              )}
              {typeof row.rating === 'number' ? (
                <span className="inline-flex items-center gap-1 text-caption tabular-nums text-ink-3">
                  <Star
                    size={11}
                    strokeWidth={2}
                    aria-hidden="true"
                    className="fill-warning text-warning"
                  />
                  {row.rating}
                </span>
              ) : null}
              {tone === undefined || label === undefined ? null : (
                <Badge tone={tone} size="sm">
                  {label}
                </Badge>
              )}
            </span>
          )}

          {row.note === null ? null : (
            <span className="mt-1 line-clamp-2 text-caption text-ink-3 italic">
              {row.note}
            </span>
          )}
        </span>
      </button>

      {actions === undefined ? null : (
        <span
          className={cn(
            'flex shrink-0 items-start pt-2',
            'opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100',
            transitionBase,
          )}
        >
          {actions}
        </span>
      )}
    </li>
  )
}
