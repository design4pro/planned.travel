import * as React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { BedDouble, Plus } from 'lucide-react'

import { cn } from '#/lib/cn'
import { focusRing, transitionBase } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { NoteRow } from './note-row'
import { noteItemId } from './ordering'
import { StopRow } from './stop-row'

import type {
  PlannerCategory,
  PlannerDay,
  PlannerNote,
  PlannerRow,
} from './types'

export interface DaySectionProps {
  readonly day: PlannerDay
  readonly categoryFor: (
    categoryId: string | null,
  ) => PlannerCategory | undefined
  /** This is the day being read: its header lifts and its route line brightens. */
  readonly active?: boolean
  readonly selectedPlaceId?: string | null
  readonly hoveredPlaceId?: string | null
  /**
   * Items with a write in flight, by **draggable** id — an assignment id for a stop,
   * `noteItemId(note.id)` for a note. One set, because the day is one sequence.
   */
  readonly pendingItemIds?: ReadonlySet<string>
  readonly draggable?: boolean
  /**
   * Whether this reader may write the day's notes — an owner or an editor on a trip
   * that is not archived. `false` renders every note and offers no way to change one.
   */
  readonly canWriteNotes?: boolean
  readonly onFocusDay?: () => void
  readonly onSelectRow?: (row: PlannerRow) => void
  readonly onHoverRow?: (row: PlannerRow, hovering: boolean) => void
  readonly rowActions?: (row: PlannerRow) => React.ReactNode
  readonly onAddNote?: () => void
  readonly onEditNote?: (note: PlannerNote) => void
  readonly onDeleteNote?: (note: PlannerNote) => void
  /** `-1` is one place earlier in the day's sequence, `1` one place later. */
  readonly onMoveNote?: (note: PlannerNote, direction: -1 | 1) => void
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
 * The list is both a `SortableContext` and a droppable, so an *empty* day is
 * still a valid drop target — the case a sortable list alone gets wrong, and the
 * one that matters most, because an empty day is exactly what you drag onto.
 *
 * **One list, two renderers.** A day is one sequence of stops and notes (PRD #104
 * decision 9), merged upstream by `mergeDayTimeline` and arriving here already in the
 * order it is read. `StopRow` and `NoteRow` render the two kinds the union carries
 * today; a third kind is a third branch of the same `switch` and nothing else.
 */
export function DaySection({
  day,
  categoryFor,
  active = false,
  selectedPlaceId = null,
  hoveredPlaceId = null,
  pendingItemIds,
  draggable = true,
  canWriteNotes = false,
  onFocusDay,
  onSelectRow,
  onHoverRow,
  rowActions,
  onAddNote,
  onEditNote,
  onDeleteNote,
  onMoveNote,
}: DaySectionProps) {
  const t = useTranslate()
  const itemIds = React.useMemo(
    () =>
      day.items.map((item) =>
        item.kind === 'stop' ? item.row.itemId : noteItemId(item.note.id),
      ),
    [day.items],
  )

  /**
   * The 1-based **place** numeral each stop wears, by item id.
   *
   * Counted over the stops alone rather than over the sequence: a note between the
   * second and the third place does not make the next place "stop 4", and a reader
   * hearing "stop 3" must be able to count three places on the day.
   */
  const stopNumbers = React.useMemo(() => {
    const numbers = new Map<string, number>()
    let seen = 0
    for (const item of day.items) {
      if (item.kind !== 'stop') continue
      seen += 1
      numbers.set(item.row.itemId, seen)
    }
    return numbers
  }, [day.items])

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
          {day.items.length === 0 ? (
            <li
              className={cn(
                'rounded-md border border-dashed border-edge-strong/60 px-3 py-3',
                'text-center text-caption text-ink-4',
                transitionBase,
                isOver && 'border-brand/50 text-brand',
              )}
            >
              {t('trips.plan.day.empty')}
            </li>
          ) : (
            day.items.map((item, index) => {
              if (item.kind === 'note') {
                const { note } = item
                return (
                  <NoteRow
                    key={noteItemId(note.id)}
                    note={note}
                    position={index}
                    count={day.items.length}
                    canWrite={canWriteNotes}
                    draggable={draggable && canWriteNotes}
                    pending={pendingItemIds?.has(noteItemId(note.id)) ?? false}
                    onMove={(direction) => onMoveNote?.(note, direction)}
                    onEdit={() => onEditNote?.(note)}
                    onDelete={() => onDeleteNote?.(note)}
                  />
                )
              }

              const { row } = item
              return (
                <StopRow
                  key={row.itemId}
                  row={row}
                  category={categoryFor(row.categoryId)}
                  position={stopNumbers.get(row.itemId) ?? null}
                  selected={row.placeId === selectedPlaceId}
                  hovered={row.placeId === hoveredPlaceId}
                  pending={pendingItemIds?.has(row.itemId) ?? false}
                  draggable={draggable}
                  onSelect={() => onSelectRow?.(row)}
                  onHoverChange={(hovering) => onHoverRow?.(row, hovering)}
                  actions={rowActions?.(row)}
                />
              )
            })
          )}
        </ul>
      </SortableContext>

      {canWriteNotes ? (
        <div className="px-2 pt-1.5 pb-2">
          <button
            type="button"
            onClick={onAddNote}
            // Ten days on one screen means ten of these, so the name a screen reader
            // hears says *which* day it writes to while the visible label stays short.
            aria-label={t('trips.plan.note.addForDay', { day: day.title })}
            className={cn(
              'flex w-full items-center justify-center gap-1.5 rounded-md',
              'border border-dashed border-edge bg-surface-2 px-3 py-2',
              'text-caption text-ink-3',
              transitionBase,
              focusRing,
              'hover:border-edge-strong hover:bg-hover hover:text-ink-2',
            )}
          >
            <Plus size={12} strokeWidth={2} aria-hidden="true" />
            {t('trips.plan.note.add')}
          </button>
        </div>
      ) : null}
    </section>
  )
}
