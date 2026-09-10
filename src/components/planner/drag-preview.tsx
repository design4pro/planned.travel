import { cn } from '#/lib/cn'
import { dayNoteIconGlyph } from './note-row'
import { PlaceThumb } from './place-thumb'

import type { PlannerCategory, PlannerNote, PlannerRow } from './types'

/**
 * The subject of a drag: one of the kinds a day's sequence holds.
 *
 * A union rather than a row with optional fields, because the two previews share no
 * content at all — a note has no photograph, no address and no category — and an
 * optional-everything shape would let a caller build a card that draws neither.
 */
export type DragPreviewProps =
  | {
      readonly row: PlannerRow
      readonly category?: PlannerCategory
      readonly className?: string
    }
  | { readonly note: PlannerNote; readonly className?: string }

const SHELL = [
  'flex w-64 max-w-[80vw] items-center gap-2.5 rounded-lg',
  'border border-edge bg-surface px-2.5 py-2 shadow-modal',
  // A degree of tilt reads as "picked up" far more cheaply than a scale or a
  // shadow step, and it is the one place in the system a rotation is honest.
  'rotate-1 cursor-grabbing',
]

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
export function DragPreview(props: DragPreviewProps) {
  if ('note' in props) {
    const { note, className } = props
    const Glyph = dayNoteIconGlyph(note.icon)
    return (
      <div
        aria-hidden="true"
        data-drag-preview="note"
        className={cn(SHELL, className)}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-inset text-ink-3">
          <Glyph size={14} strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-label font-semibold text-ink">
            {note.body}
          </p>
          {note.time === null ? null : (
            <p className="truncate text-caption tabular-nums text-ink-3">
              {note.time}
            </p>
          )}
        </div>
      </div>
    )
  }

  const { row, category, className } = props
  return (
    <div
      aria-hidden="true"
      data-drag-preview="stop"
      className={cn(SHELL, className)}
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
