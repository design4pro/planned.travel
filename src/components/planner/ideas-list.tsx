import * as React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Lightbulb, Search } from 'lucide-react'

import { cn } from '#/lib/cn'
import {
  Badge,
  EmptyState,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
  transitionBase,
} from '#/components/ui'
import { IDEAS_CONTAINER } from './ordering'
import { StopRow } from './stop-row'

import type { PlannerCategory, PlannerRow } from './types'

/** Which slice of the trip's places the rail is showing. */
export type PlacesScope = 'all' | 'unplanned'

const SCOPES: ReadonlyArray<{ value: PlacesScope; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'unplanned', label: 'Unplanned' },
]

export interface IdeasListProps {
  /** Rows to show. Already filtered by the screen's search and category chips. */
  readonly rows: ReadonlyArray<PlannerRow>
  /** Rows before filtering, so the empty state can tell "none" from "none matching". */
  readonly total: number
  readonly categoryFor: (
    categoryId: string | null,
  ) => PlannerCategory | undefined
  readonly query: string
  readonly onQueryChange: (next: string) => void
  readonly selectedPlaceId?: string | null
  readonly hoveredPlaceId?: string | null
  readonly pendingItemIds?: ReadonlySet<string>
  readonly draggable?: boolean
  readonly onSelectRow?: (row: PlannerRow) => void
  readonly onHoverRow?: (row: PlannerRow, hovering: boolean) => void
  readonly rowActions?: (row: PlannerRow) => React.ReactNode
  /**
   * Shows a scope switch above the search field.
   *
   * A trip whose every place already has a day would otherwise leave this rail
   * empty — a quarter of the planner's width spent saying "nothing here" while
   * 38 places sit on the map beside it. With the switch, `all` makes the rail the
   * trip's place index (each row badged with the day it belongs to, so it reads
   * as an index of the map rather than a second itinerary) and `unplanned` keeps
   * the staging pile the drag-out gesture needs. Omit both props and the rail
   * behaves exactly as before.
   */
  readonly scope?: PlacesScope
  readonly onScopeChange?: (next: PlacesScope) => void
  /** Unfiltered counts for the two scopes, shown on the switch. */
  readonly scopeCounts?: Readonly<Record<PlacesScope, number>>
}

/**
 * The ideas column: places collected but not yet given a day.
 *
 * A droppable in its own right, so dragging a stop out of a day *unschedules* it
 * rather than deleting it — the move a plan needs constantly and the one a rail of
 * day lists alone cannot express.
 *
 * Search is controlled from the screen rather than held here, because the same
 * query narrows the pins on the map. Typing "shrine" should thin out both halves of
 * the screen at once; a local input would leave the map disagreeing with the list.
 */
export function IdeasList({
  rows,
  total,
  categoryFor,
  query,
  onQueryChange,
  selectedPlaceId = null,
  hoveredPlaceId = null,
  pendingItemIds,
  draggable = true,
  onSelectRow,
  onHoverRow,
  rowActions,
  scope,
  onScopeChange,
  scopeCounts,
}: IdeasListProps) {
  /**
   * Only the rows that can actually be dragged join the sortable context.
   *
   * In `all` scope a scheduled row is an index entry, and its draggable twin is
   * already in the itinerary rail under the same id — `@dnd-kit` keys its registry
   * by id, so letting both register would have the index's node shadow the real
   * one. `indexOnly` marks those rows: out of the sortable context, no drag
   * handle, and a namespaced sortable id so nothing collides.
   */
  const indexOnly = React.useCallback(
    (row: PlannerRow): boolean => scope === 'all' && row.dayNumber !== null,
    [scope],
  )
  const itemIds = React.useMemo(
    () => rows.filter((row) => !indexOnly(row)).map((row) => row.itemId),
    [rows, indexOnly],
  )
  const { setNodeRef, isOver } = useDroppable({ id: IDEAS_CONTAINER })
  const showScope =
    scope !== undefined &&
    onScopeChange !== undefined &&
    scopeCounts !== undefined

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {showScope ? (
        <Tabs
          value={scope}
          onValueChange={(next) => {
            if (next === 'all' || next === 'unplanned') onScopeChange(next)
          }}
          variant="segmented"
          size="sm"
        >
          <TabsList aria-label="Which places to list" className="w-full">
            {SCOPES.map((option) => (
              <TabsTrigger
                key={option.value}
                value={option.value}
                className="flex-1"
                badge={
                  <Badge
                    tone={scope === option.value ? 'accent' : 'outline'}
                    size="sm"
                    className="tabular-nums"
                  >
                    {scopeCounts[option.value]}
                  </Badge>
                }
              >
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}

      <Input
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search places"
        aria-label="Search this trip's places"
        leading={<Search />}
        size="sm"
        className="bg-surface/70"
      />

      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <ul
          ref={setNodeRef}
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg px-1 py-0.5',
            'flex flex-col gap-0.5',
            transitionBase,
            isOver && 'bg-brand-subtle/60 ring-1 ring-brand/40 ring-inset',
          )}
        >
          {rows.length === 0 ? (
            <li className="px-1 py-4">
              {total === 0 ? (
                <EmptyState
                  size="sm"
                  icon={<Lightbulb />}
                  title={scope === 'all' ? 'No places yet' : 'No ideas waiting'}
                  description={
                    scope === 'all'
                      ? 'Add a place and it appears here and on the map at once.'
                      : 'Everything you have collected already has a day. Add a place and it lands here first.'
                  }
                />
              ) : (
                <EmptyState
                  size="sm"
                  icon={<Search />}
                  title="Nothing matches"
                  description={
                    scope === 'all'
                      ? 'No place on this trip matches the current search and filters.'
                      : 'No unplanned place matches the current search and filters.'
                  }
                />
              )}
            </li>
          ) : (
            rows.map((row) => (
              <StopRow
                key={row.itemId}
                row={row}
                sortableId={
                  indexOnly(row) ? `places-index:${row.itemId}` : undefined
                }
                category={categoryFor(row.categoryId)}
                position={scope === 'all' ? row.dayNumber : null}
                positionKind="day"
                selected={row.placeId === selectedPlaceId}
                hovered={row.placeId === hoveredPlaceId}
                pending={pendingItemIds?.has(row.itemId) ?? false}
                draggable={draggable && !indexOnly(row)}
                onSelect={() => onSelectRow?.(row)}
                onHoverChange={(hovering) => onHoverRow?.(row, hovering)}
                actions={rowActions?.(row)}
              />
            ))
          )}
        </ul>
      </SortableContext>
    </div>
  )
}
