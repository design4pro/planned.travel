import * as React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { BedDouble, StickyNote } from 'lucide-react'

import { cn } from '#/lib/cn'
import { focusRing, transitionBase } from '#/components/ui'
import { StopRow } from './stop-row'

import type { PlannerCategory, PlannerDay, PlannerRow } from './types'

export interface DaySectionProps {
  readonly day: PlannerDay
  readonly categoryFor: (
    categoryId: string | null,
  ) => PlannerCategory | undefined
  /** This is the day being read: its header lifts and its route line brightens. */
  readonly active?: boolean
  readonly selectedPlaceId?: string | null
  readonly hoveredPlaceId?: string | null
  /** Rows with a write in flight. */
  readonly pendingItemIds?: ReadonlySet<string>
  readonly draggable?: boolean
  readonly onFocusDay?: () => void
  readonly onSelectRow?: (row: PlannerRow) => void
  readonly onHoverRow?: (row: PlannerRow, hovering: boolean) => void
  readonly rowActions?: (row: PlannerRow) => React.ReactNode
}

/**
 * One day of the itinerary in the rail.
 *
 * The header is a real button that focuses the day, because "show me just
 * Wednesday" is the single most common thing a reader wants from a ten-day plan and
 * the reference offers no way to ask for it. Focusing a day dims the other days'
 * route lines on the map, which turns the rail into a filter for the map without
 * adding a control anywhere.
 *
 * The stop list is both a `SortableContext` and a droppable, so an *empty* day is
 * still a valid drop target — the case a sortable list alone gets wrong, and the
 * one that matters most, because an empty day is exactly what you drag onto.
 */
export function DaySection({
  day,
  categoryFor,
  active = false,
  selectedPlaceId = null,
  hoveredPlaceId = null,
  pendingItemIds,
  draggable = true,
  onFocusDay,
  onSelectRow,
  onHoverRow,
  rowActions,
}: DaySectionProps) {
  const itemIds = React.useMemo(
    () => day.rows.map((row) => row.itemId),
    [day.rows],
  )

  const { setNodeRef, isOver } = useDroppable({ id: day.dayId })

  const stops = day.rows.length === 1 ? '1 stop' : `${day.rows.length} stops`

  return (
    <section
      aria-label={`${day.title}${day.dateLabel === null ? '' : `, ${day.dateLabel}`}`}
      className={cn(
        'rounded-xl',
        transitionBase,
        // Focusing a day dims every other day's route line on the map, so the rail
        // has to show which one is doing that — a wash plus a hairline, the same
        // pairing a selected row uses one level down.
        active && 'bg-brand-subtle/45 ring-1 ring-brand/20 ring-inset',
      )}
    >
      <button
        type="button"
        onClick={onFocusDay}
        aria-pressed={active}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-start',
          transitionBase,
          focusRing,
          'hover:bg-hover',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-md',
            'font-display text-caption font-bold tabular-nums',
            transitionBase,
            active ? 'bg-brand text-brand-on' : 'bg-accent text-accent-on',
          )}
        >
          {day.dayNumber}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="min-w-0 truncate font-display text-label font-bold tracking-tight text-ink">
              {day.title}
            </span>
            {day.dateLabel === null ? null : (
              <span className="shrink-0 text-caption tabular-nums text-ink-3">
                {day.dateLabel}
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-caption tabular-nums text-ink-4">
            {stops}
          </span>
        </span>
      </button>

      {day.stays.length === 0 ? null : (
        <ul className="flex flex-wrap gap-1.5 px-2 pb-1.5">
          {day.stays.map((stay) => (
            <li
              key={stay}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-info-soft px-2 py-0.5 text-caption font-medium text-info"
            >
              <BedDouble size={11} strokeWidth={2} aria-hidden="true" />
              <span className="min-w-0 truncate">{stay}</span>
            </li>
          ))}
        </ul>
      )}

      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <ul
          ref={setNodeRef}
          className={cn(
            'flex flex-col gap-0.5 rounded-lg px-1 py-0.5',
            transitionBase,
            // A drop target has to be visible *before* the drop, and an outline
            // rather than a fill so the rows underneath stay readable.
            isOver && 'bg-brand-subtle/60 ring-1 ring-brand/40 ring-inset',
          )}
        >
          {day.rows.length === 0 ? (
            <li
              className={cn(
                'rounded-md border border-dashed border-edge-strong/60 px-3 py-3',
                'text-center text-caption text-ink-4',
                transitionBase,
                isOver && 'border-brand/50 text-brand',
              )}
            >
              Nothing planned — drop a place here
            </li>
          ) : (
            day.rows.map((row, index) => (
              <StopRow
                key={row.itemId}
                row={row}
                category={categoryFor(row.categoryId)}
                position={index + 1}
                selected={row.placeId === selectedPlaceId}
                hovered={row.placeId === hoveredPlaceId}
                pending={pendingItemIds?.has(row.itemId) ?? false}
                draggable={draggable}
                onSelect={() => onSelectRow?.(row)}
                onHoverChange={(hovering) => onHoverRow?.(row, hovering)}
                actions={rowActions?.(row)}
              />
            ))
          )}
        </ul>
      </SortableContext>

      {day.notes.length === 0 ? null : (
        <ul className="flex flex-col gap-1.5 px-3 pt-1.5 pb-2">
          {day.notes.map((note) => (
            <li
              key={note.id}
              className="flex min-w-0 items-start gap-1.5 text-caption text-ink-3"
            >
              <StickyNote
                size={11}
                strokeWidth={2}
                aria-hidden="true"
                className="mt-1 shrink-0 text-ink-4"
              />
              <span className="min-w-0">
                {note.time === null ? null : (
                  <span className="me-1.5 font-semibold tabular-nums text-ink-2">
                    {note.time}
                  </span>
                )}
                {note.body}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
