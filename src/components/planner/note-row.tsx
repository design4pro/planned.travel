import * as React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  AlarmClock,
  BedDouble,
  Bus,
  Camera,
  ChevronDown,
  ChevronUp,
  Clock,
  Flashlight,
  Footprints,
  GripVertical,
  Info,
  Luggage,
  MapPin,
  Package,
  Pencil,
  StickyNote,
  Ticket,
  TrainFront,
  TriangleAlert,
  Trash2,
  Umbrella,
  Utensils,
  Wallet,
  Wifi,
} from 'lucide-react'

import { cn } from '#/lib/cn'
import {
  IconButton,
  Spinner,
  focusRing,
  staggerDelay,
  transitionBase,
} from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { Markdown } from '#/lib/markdown/render'
import { noteItemId } from './ordering'
import { DEFAULT_DAY_NOTE_ICON } from './types'

import type { LucideIcon } from 'lucide-react'
import type { MessageKey } from '#/lib/i18n'
import type { DayNoteIcon, PlannerNote } from './types'

/**
 * The nineteen glyphs of the note vocabulary.
 *
 * A curated registry rather than `lucide-react`'s dynamic loader, for the reason
 * `src/components/map/category-icon.tsx` already records: the loader ships a chunk per
 * icon and resolves after paint, so a day of notes would visibly pop in. The write path
 * narrowed to these names in `01-S2b`, but no migration narrowed the rows written before
 * it — an unknown stored name therefore falls back to the sticky note, never to nothing.
 */
const ICONS: Readonly<Record<DayNoteIcon, LucideIcon>> = {
  'alarm-clock': AlarmClock,
  clock: Clock,
  flashlight: Flashlight,
  footprints: Footprints,
  info: Info,
  luggage: Luggage,
  package: Package,
  ticket: Ticket,
  'train-front': TrainFront,
  wifi: Wifi,
  'sticky-note': StickyNote,
  utensils: Utensils,
  bus: Bus,
  'bed-double': BedDouble,
  camera: Camera,
  'map-pin': MapPin,
  wallet: Wallet,
  umbrella: Umbrella,
  'triangle-alert': TriangleAlert,
}

/**
 * What each glyph is called, in the reader's language.
 *
 * The tile is a meaningful image and not decoration — "warning" and "meal" are the
 * whole point of choosing one — so it carries a name here and is the accessible name of
 * one radio in the editor's picker. Whole literals, so `i18n/__tests__/coverage.test.ts`
 * can see that every key in the catalogue has a reader.
 */
const ICON_LABEL: Readonly<Record<DayNoteIcon, MessageKey>> = {
  'alarm-clock': 'trips.plan.note.icon.alarmClock',
  clock: 'trips.plan.note.icon.clock',
  flashlight: 'trips.plan.note.icon.flashlight',
  footprints: 'trips.plan.note.icon.footprints',
  info: 'trips.plan.note.icon.info',
  luggage: 'trips.plan.note.icon.luggage',
  package: 'trips.plan.note.icon.package',
  ticket: 'trips.plan.note.icon.ticket',
  'train-front': 'trips.plan.note.icon.trainFront',
  wifi: 'trips.plan.note.icon.wifi',
  'sticky-note': 'trips.plan.note.icon.stickyNote',
  utensils: 'trips.plan.note.icon.utensils',
  bus: 'trips.plan.note.icon.bus',
  'bed-double': 'trips.plan.note.icon.bedDouble',
  camera: 'trips.plan.note.icon.camera',
  'map-pin': 'trips.plan.note.icon.mapPin',
  wallet: 'trips.plan.note.icon.wallet',
  umbrella: 'trips.plan.note.icon.umbrella',
  'triangle-alert': 'trips.plan.note.icon.triangleAlert',
}

/**
 * The stored name, narrowed to one this build can draw.
 *
 * `Object.hasOwn` rather than `in`: the column took any short text until `01-S2b`, so a row can
 * hold `constructor` or `toString`, and `in` answers yes for both — the registry would then hand
 * back a function off `Object.prototype` and the day would render an exception instead of a note.
 */
export function dayNoteIcon(name: string): DayNoteIcon {
  return Object.hasOwn(ICONS, name)
    ? (name as DayNoteIcon)
    : DEFAULT_DAY_NOTE_ICON
}

/** The glyph for a stored icon name. Always resolves. */
export function dayNoteIconGlyph(name: string): LucideIcon {
  return ICONS[dayNoteIcon(name)]
}

/** The message key naming a stored icon name. Always resolves. */
export function dayNoteIconLabel(name: string): MessageKey {
  return ICON_LABEL[dayNoteIcon(name)]
}

export interface NoteRowProps {
  readonly note: PlannerNote
  /** Position in the day's run, 0-based: the ends disable their own chevron. */
  readonly position: number
  /** How long the run is, for the same reason. */
  readonly count: number
  /** `false` renders the note with no actions at all — a viewer, or an archived trip. */
  readonly canWrite: boolean
  /** Greys the row and puts a spinner in the icon's place while a write is in flight. */
  readonly pending?: boolean
  /**
   * `false` renders the note without a drag handle — a read-only trip, or a surface
   * with no drag context above it. Opt-in rather than opt-out, unlike `StopRow`: the
   * note run reached the screen without a drag at all until `01-S4b`.
   */
  readonly draggable?: boolean
  readonly onMove?: (direction: -1 | 1) => void
  readonly onEdit?: () => void
  readonly onDelete?: () => void
}

/**
 * One note in a day section.
 *
 * A note is one line until a reader asks for more: the headline is what the day shows,
 * and the detail — markdown, rendered through the subset `01-S2a` shipped — arrives
 * behind a disclosure that exists **only** when there is something behind it. A
 * present-and-disabled chevron on every second note would say "there is more here" about
 * a note that has nothing more.
 *
 * The two move controls are `disabled` at the ends of the run rather than hidden, so the
 * cluster keeps its width and a reader moving a note down does not watch the controls
 * they are aiming at shift under the pointer.
 */
export function NoteRow({
  note,
  position,
  count,
  canWrite,
  pending = false,
  draggable = false,
  onMove,
  onEdit,
  onDelete,
}: NoteRowProps) {
  const t = useTranslate()
  const [open, setOpen] = React.useState(false)
  const detailId = React.useId()

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: noteItemId(note.id),
    disabled: !draggable || pending,
  })

  const Glyph = dayNoteIconGlyph(note.icon)
  const hasDetail = note.detail !== null && note.detail.trim().length > 0

  return (
    <li
      ref={setNodeRef}
      // Only while no drag offset is in play. The attribute exists for the entrance
      // animation, and reduced motion resets it with `transform: none !important` —
      // which would also cancel the offset that makes the row follow the pointer, so
      // a reader who asked for less motion would drag a row that never moves.
      data-motion-transform={transform === null ? '' : undefined}
      style={{
        animationDelay: staggerDelay(position),
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      className={cn(
        'group/note animate-rise relative flex flex-col rounded-lg px-1 py-1',
        transitionBase,
        isDragging && 'z-10 opacity-40',
        pending && 'opacity-60',
      )}
      data-planner-note={note.id}
    >
      <div className="flex min-w-0 items-start gap-2">
        <span
          role="img"
          aria-label={t(dayNoteIconLabel(note.icon))}
          className="grid size-6 shrink-0 place-items-center rounded-md bg-surface-inset text-ink-3"
        >
          {pending ? (
            <Spinner size="xs" label={null} />
          ) : (
            <Glyph size={12} strokeWidth={2} aria-hidden="true" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-baseline gap-2">
            {note.time === null ? null : (
              <span className="shrink-0 text-caption font-semibold tabular-nums text-ink-2">
                {note.time}
              </span>
            )}
            <span className="min-w-0 flex-1 text-caption text-ink-2">
              {note.body}
            </span>
          </span>

          {hasDetail ? (
            <button
              type="button"
              onClick={() => setOpen((shown) => !shown)}
              aria-expanded={open}
              aria-controls={detailId}
              className={cn(
                'mt-1 inline-flex items-center gap-1 rounded-sm text-caption text-ink-4',
                transitionBase,
                focusRing,
                'hover:text-ink-2',
              )}
            >
              <ChevronDown
                size={11}
                strokeWidth={2}
                aria-hidden="true"
                data-motion-transform=""
                className={cn(
                  'transition-transform duration-fast ease-out-quint',
                  open && 'rotate-180',
                )}
              />
              {open
                ? t('trips.plan.note.showLess')
                : t('trips.plan.note.showMore')}
            </button>
          ) : null}
        </span>

        {canWrite ? (
          // Over the row rather than beside it. Four controls beside the text would
          // reserve roughly a third of a rail that is 340px wide on a 1280px screen,
          // and the note — the thing being read — would wrap into a column barely
          // wider than its own timestamp. So the cluster leaves the flow, and floats
          // on its own surface when the row is hovered or holds focus.
          <span
            className={cn(
              'absolute end-1 top-0.5 z-10 flex items-center rounded-lg',
              'border border-edge bg-surface shadow-card',
              'opacity-0 group-hover/note:opacity-100 group-focus-within/note:opacity-100',
              // An invisible layer over the headline would still take the pointer,
              // and the reader would be selecting nothing where the words are.
              'pointer-events-none group-hover/note:pointer-events-auto group-focus-within/note:pointer-events-auto',
              transitionBase,
            )}
          >
            {draggable ? (
              // Inside the cluster rather than beside the text: the rail is 340px
              // wide and a note is mostly words, so a sixth column would take the
              // headline apart to save the cluster one hover.
              //
              // Not `disabled` while pending, for `StopRow`'s reason — a disabled
              // button cannot hold focus, so a keyboard drop would drop the reader's
              // focus with it. `@dnd-kit`'s own `aria-disabled` says as much, and its
              // sensor refuses to lift a disabled sortable anyway.
              <IconButton
                ref={setActivatorNodeRef}
                size="sm"
                variant="ghost"
                label={t('trips.plan.note.drag')}
                icon={<GripVertical />}
                className="cursor-grab active:cursor-grabbing aria-disabled:cursor-default"
                {...attributes}
                {...listeners}
              />
            ) : null}
            <IconButton
              size="sm"
              variant="ghost"
              label={t('trips.plan.note.moveUp')}
              icon={<ChevronUp />}
              disabled={pending || position === 0}
              onClick={() => onMove?.(-1)}
            />
            <IconButton
              size="sm"
              variant="ghost"
              label={t('trips.plan.note.moveDown')}
              icon={<ChevronDown />}
              disabled={pending || position === count - 1}
              onClick={() => onMove?.(1)}
            />
            <IconButton
              size="sm"
              variant="ghost"
              label={t('trips.plan.note.edit')}
              icon={<Pencil />}
              disabled={pending}
              onClick={() => onEdit?.()}
            />
            <IconButton
              size="sm"
              variant="danger"
              label={t('trips.plan.note.delete')}
              icon={<Trash2 />}
              disabled={pending}
              onClick={() => onDelete?.()}
            />
          </span>
        ) : null}
      </div>

      {hasDetail && open ? (
        // Its own scroll container: a note with a long detail must not push the rest of
        // the day out of the rail to be read.
        <div
          id={detailId}
          className="mt-1.5 max-h-64 overflow-y-auto rounded-md bg-surface-2 py-2 pe-2.5 ps-8"
        >
          <Markdown text={note.detail} className="text-caption" />
        </div>
      ) : null}
    </li>
  )
}
