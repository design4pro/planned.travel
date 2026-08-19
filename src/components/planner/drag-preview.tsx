import { cn } from '#/lib/cn'
import { PlaceThumb } from './place-thumb'

import type { PlannerCategory, PlannerRow } from './types'

export interface DragPreviewProps {
  readonly row: PlannerRow
  readonly category?: PlannerCategory
  readonly className?: string
}

/**
 * What follows the pointer during a drag.
 *
 * A `DragOverlay` child rather than a transformed copy of the row: the row itself
 * lives inside a rail that clips its own overflow, so dragging without an overlay
 * makes the card disappear at the panel edge — the exact moment the reader most
 * needs to see what they are holding.
 *
 * Deliberately smaller and simpler than the row: while it is in the air the only
 * questions are "what am I holding" and "where is it going", and a full row with
 * badges and a note competes with the drop target underneath it.
 */
export function DragPreview({ row, category, className }: DragPreviewProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex w-64 max-w-[80vw] items-center gap-2.5 rounded-lg',
        'border border-edge bg-surface px-2.5 py-2 shadow-modal',
        // A degree of tilt reads as "picked up" far more cheaply than a scale or a
        // shadow step, and it is the one place in the system a rotation is honest.
        'rotate-1 cursor-grabbing',
        className,
      )}
    >
      <PlaceThumb
        placeId={row.placeId}
        imageUrl={row.imageUrl}
        icon={category?.icon}
        colour={category?.colour}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-label font-semibold text-ink">{row.name}</p>
        <p className="truncate text-caption text-ink-3">
          {row.location ?? category?.name ?? 'Place'}
        </p>
      </div>
    </div>
  )
}
