import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

import { cn } from '#/lib/cn'
import { Badge, focusRing, staggerDelay, transitionBase } from '#/components/ui'
// The two leaf modules rather than the module's barrel: the barrel reaches the booking
// dialogs, which reach `src/server`, and the planner imports from neither.
import { modeIcon } from '#/components/modules/transports/mode-icon'
import {
  modeLabel,
  transportStatusLabel,
} from '#/components/modules/transports/vocabulary'
import { useTranslate } from '#/lib/i18n'

import type { BadgeTone } from '#/components/ui'
import type { Translate } from '#/lib/i18n'
import type { PlannerTransport } from './types'

/**
 * Transport states worth a badge.
 *
 * Partial for `StopRow`'s reason: `idea` is the resting state a journey is created in, and
 * badging every journey "Idea" would put a pill on a day that is entirely ideas.
 */
const STATUS_TONE: Partial<Record<string, BadgeTone>> = {
  pending: 'warning',
  confirmed: 'success',
  completed: 'neutral',
  cancelled: 'danger',
}

/**
 * The journey said in words — "Tokyo to Kyoto".
 *
 * Exported because it is the row's accessible name *and* what the drag announcements name,
 * and two places deriving it separately is how a reader ends up hearing one journey called
 * two things. Either endpoint may be missing — nothing requires a name on a leg — so it
 * degrades to the endpoint it has, and then to the mode.
 */
export function journeyName(t: Translate, transport: PlannerTransport): string {
  const { fromName, toName } = transport
  if (fromName !== null && toName !== null) {
    return t('trips.plan.transport.label', { from: fromName, to: toName })
  }
  return fromName ?? toName ?? t(modeLabel(transport.mode))
}

export interface TransportRowProps {
  readonly transport: PlannerTransport
  /** Position in the day's sequence, 0-based — the entrance stagger's only input. */
  readonly position: number
  /**
   * `false` renders the row without a drag handle — a read-only trip, or a surface with no
   * drag context above it. A `travelling` or `arriving` row never gets one either way: a
   * journey has one `sort_order` and it belongs to the day it leaves.
   */
  readonly draggable?: boolean
  /** Greys the row while a write is in flight. */
  readonly pending?: boolean
}

/**
 * One journey, on one of the days it covers.
 *
 * Everything the row shows is already a string by the time it arrives: the phase is a message
 * key chosen by mode, the clock and the fare are formatted at the route boundary. What is left
 * here is the arrangement — the mode's glyph, the two endpoints, the clock, the service number
 * and the status — and the one decision that is not cosmetic: only the `departing` row is
 * draggable, because the number a drag writes has exactly one ruler.
 */
export function TransportRow({
  transport,
  position,
  draggable = false,
  pending = false,
}: TransportRowProps) {
  const t = useTranslate()
  const handled = draggable && transport.part === 'departing'

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: transport.itemId,
    disabled: !handled || pending,
  })

  const Glyph = modeIcon(transport.mode)
  const tone = STATUS_TONE[transport.status]
  const name = journeyName(t, transport)

  return (
    <li
      ref={setNodeRef}
      // See `NoteRow`: the attribute drives the entrance animation only, and must not be set
      // while a drag offset is in play or reduced motion would cancel the offset too.
      data-motion-transform={transform === null ? '' : undefined}
      style={{
        animationDelay: staggerDelay(position),
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      className={cn(
        'group/journey animate-rise flex items-start gap-1.5 rounded-lg',
        'border border-edge-faint bg-surface px-1.5 py-1.5',
        transitionBase,
        isDragging && 'z-10 opacity-40',
        pending && 'opacity-60',
      )}
      data-part="planner-transport-row"
      data-planner-item={transport.itemId}
    >
      {handled ? (
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label={name}
          // Not `disabled` while pending, for `StopRow`'s reason: a disabled button cannot
          // hold focus, so a keyboard drop would drop the reader's focus with it.
          className={cn(
            'grid w-4 shrink-0 cursor-grab place-items-center self-center rounded-sm text-ink-4',
            'opacity-0 group-hover/journey:opacity-100 focus:opacity-100',
            'hover:text-ink-2 active:cursor-grabbing',
            'aria-disabled:cursor-default aria-disabled:text-ink-4',
            transitionBase,
            focusRing,
          )}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={12} strokeWidth={2} aria-hidden="true" />
        </button>
      ) : (
        <span className="w-4 shrink-0" aria-hidden="true" />
      )}

      <span
        className="grid size-6 shrink-0 place-items-center rounded-md bg-surface-inset text-ink-3"
        role="img"
        aria-label={t(modeLabel(transport.mode))}
      >
        <Glyph size={12} strokeWidth={2} aria-hidden="true" />
      </span>

      <span className="min-w-0 flex-1">
        {transport.phase === null ? null : (
          <span className="block text-micro uppercase tracking-label text-ink-3">
            {t(transport.phase)}
          </span>
        )}

        <span className="flex min-w-0 items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-caption font-medium text-ink-2">
            {name}
          </span>
          {transport.time === null ? null : (
            <span className="shrink-0 text-caption font-semibold tabular-nums text-ink-2">
              {transport.time}
            </span>
          )}
        </span>

        {transport.serviceNumber === null &&
        transport.price === null &&
        tone === undefined ? null : (
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {transport.serviceNumber === null ? null : (
              <span className="text-caption text-ink-3">
                {transport.serviceNumber}
              </span>
            )}
            {tone === undefined ? null : (
              <Badge tone={tone} size="sm">
                {t(transportStatusLabel(transport.status))}
              </Badge>
            )}
            {transport.price === null ? null : (
              <span className="text-caption tabular-nums text-ink-3">
                {transport.price}
              </span>
            )}
          </span>
        )}
      </span>
    </li>
  )
}
