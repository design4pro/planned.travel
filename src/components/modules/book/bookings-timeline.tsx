/**
 * The bookings desk: what is settled, what is not, and what is nobody else's
 * business.
 *
 * Bookings are not a table of rows: they are things that happen on days, so the
 * screen is grouped by date with a rail down the left, a date stamp at each
 * junction and the day's bookings hanging off it. Undated bookings collect at the
 * end under their own heading rather than being scattered through the dates with
 * a blank where the date should be.
 *
 * On top of that, **two panels rather than one list**. What still needs chasing
 * is not buried under what is done: outstanding bookings come first, settled ones
 * after, each with its own count and its own disclosure, and the date grouping
 * runs again *inside* each. Which panel a reader folded away is remembered per
 * trip, in `localStorage`, because unlike "which tab was I on" this is a working
 * preference that should survive a lunch break.
 *
 * **A filter of type chips**, multi-select, offering only the kinds this trip
 * actually has. It lasts for the session and no longer: a filter is a lens for
 * the next ten minutes, not a setting.
 *
 * **An import marker** on any booking a machine wrote that nobody has looked at
 * since — cleared by the first save of that booking, because reviewing it is the
 * act of reviewing it and not a second chore afterwards.
 *
 * **A masked confirmation code**, when the reader's own display preference asks
 * for it. `maskCodes` arrives as a prop: a `components/modules` component never
 * fetches and never imports from `server/`.
 *
 * Every card is live: the status pill is the control that changes the status, the
 * confirmation number copies itself, and the overflow menu edits, re-attaches or
 * removes the booking. Stored values are typeset as facts, never as filled boxes
 * that read like disabled inputs.
 */
import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  CalendarOff,
  ChevronRight,
  ExternalLink,
  Link2,
  Pencil,
  Route as RouteIcon,
  Ticket,
  Trash2,
  Users,
} from 'lucide-react'

import { Badge, Button, Chip, EmptyState } from '#/components/ui'
import { cn } from '#/lib/cn'
import {
  formatDate,
  formatDayMonth,
  formatWeekday,
  parseIsoDate,
  weekdayName,
} from '#/lib/format'
import {
  defineKeyedPreference,
  useKeyedPreference,
} from '#/lib/local-preference'
import { formatMoney } from '#/lib/money'
import { useLocale, useTranslate } from '#/lib/i18n'

import type { Locale, MessageKey, Translate } from '#/lib/i18n'
import { deleteBookingFn, setBookingStatusFn } from '#/server/fns/reservations'
import {
  ConfirmDialog,
  FactList,
  FactNote,
  FilterRow,
  MaskedCode,
  RowMenu,
  StatusMenu,
  useAction,
  useOptimistic,
} from '../shared'
import { BOOKING_TYPE_ICON, BookingDialog, dayLabel } from './booking-dialog'
import {
  countBookingTypes,
  filterBookingsByType,
  groupBookingsByDate,
  partitionBookings,
} from './grouping'
import {
  BOOKING_STATUSES,
  bookingTypeLabel,
  isBookingStatus,
  isBookingType,
} from './booking-form'

import type { BadgeTone } from '#/components/ui'
import type { BookingDayOption, BookingRow } from '#/server/fns/reservations'
import type { ConfirmRequest, FactItem, StatusOption } from '../shared'
import type { BookingStatus } from './booking-form'
import type { BookingDateGroup } from './grouping'

/* ------------------------------------------------------------------- labels */

const STATUS_TONE: { readonly [K in BookingStatus]: BadgeTone } = {
  none: 'outline',
  pending: 'warning',
  confirmed: 'success',
  completed: 'neutral',
  cancelled: 'danger',
}

const STATUS_LABEL: { readonly [K in BookingStatus]: MessageKey } = {
  none: 'modules.book.status.none',
  pending: 'modules.book.status.pending',
  confirmed: 'modules.book.status.confirmed',
  completed: 'modules.book.status.completed',
  cancelled: 'modules.book.status.cancelled',
}

/**
 * The options and the current one, both resolved at render.
 *
 * `STATUS_LABEL` holds keys rather than words, so neither of these can be a
 * module constant any more: a constant cannot call a hook, and a label frozen
 * at import time would be frozen in one language.
 */
function statusOptions(t: Translate): ReadonlyArray<StatusOption> {
  return BOOKING_STATUSES.map((value) => ({
    value,
    label: t(STATUS_LABEL[value]),
    tone: STATUS_TONE[value],
  }))
}

function statusOption(status: string, t: Translate): StatusOption {
  const known = isBookingStatus(status) ? status : 'none'
  return {
    value: known,
    label: t(STATUS_LABEL[known]),
    tone: STATUS_TONE[known],
  }
}

/**
 * `2026-10-09` → `Fri 9 Oct` and `2026`, from the shared CLDR table rather than
 * from a module-local `Intl.DateTimeFormat`: workerd and WebKit resolve
 * `month: 'short'` from different ICU builds, which React reports as a hydration
 * mismatch on every trip that has a dated booking. `src/lib/format.ts` answers
 * from a frozen table for exactly this reason.
 *
 * The year is the ISO string's own first four characters and not a second
 * formatter: a calendar date's year is the four digits it starts with in every
 * locale, and a formatter that can disagree about it is a formatter that can be
 * wrong about it.
 *
 * The medallion's two lines are asked for separately rather than sliced out of
 * the one-line label. `Fri 9 Oct` splits on a space; `10月9日(金)` does not, and a
 * medallion built by cutting a formatted string apart is a medallion that is
 * blank in half the catalogue.
 */
interface DateStamp {
  /** `Fri 9 Oct`, for the heading beside the rail. */
  readonly label: string
  /** `Fri` and `9 Oct`: the medallion's two lines, lower one first. */
  readonly weekday: string
  readonly dayMonth: string
  readonly year: string
}

function stampFor(date: string, locale: Locale): DateStamp {
  const label = formatWeekday(date, locale)
  const parsed = parseIsoDate(date)
  if (label === null || parsed === null) {
    return { label: date, weekday: date, dayMonth: '', year: '' }
  }
  return {
    label,
    weekday: weekdayName(parsed.getUTCDay(), locale) ?? '',
    dayMonth: formatDayMonth(date, locale) ?? '',
    year: date.slice(0, 4),
  }
}

function timeRange(start: string | null, end: string | null): string | null {
  const from = start === null || start.length < 4 ? null : start.slice(0, 5)
  const to = end === null || end.length < 4 ? null : end.slice(0, 5)
  if (from === null && to === null) {
    return null
  }
  if (from === null) {
    return `until ${to ?? ''}`
  }
  return to === null ? from : `${from} – ${to}`
}

/* ---------------------------------------------------- remembered by the reader */

/**
 * Which of the two panels a reader folded away, remembered per trip.
 *
 * `local` rather than `session` because this is a working preference: a reader
 * who folds the settled panel away on Monday is owed it folded on Thursday, not
 * unfolded again. The trade — it does not follow them to a second device — is
 * the one `01-S3` argued for the trip tab and is accepted here for the same
 * reason.
 *
 * Layout-affecting first paint (`local-preference.ts`, rule 1): both hooks
 * answer with the fallback on the server and in the hydrating render, so the
 * markup agrees byte for byte and the stored fold arrives in the commit after.
 * The fallback is **both panels open**, which is the state a reader who has
 * never folded anything sees — so the only screen that moves at all is one whose
 * owner asked for it to be folded, and it moves once, before anything else has
 * settled.
 */
interface FoldState {
  readonly settled: boolean
  readonly outstanding: boolean
}

const BOTH_OPEN: FoldState = { settled: false, outstanding: false }

function isFoldState(value: unknown): value is FoldState {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.settled === 'boolean' &&
    typeof record.outstanding === 'boolean'
  )
}

const BOOK_GROUPS_PREFERENCE = defineKeyedPreference<FoldState>({
  key: 'planned.book-groups',
  area: 'local',
  limit: 24,
  fallback: BOTH_OPEN,
  parse: (raw) => {
    const value: unknown = JSON.parse(raw)
    return isFoldState(value) ? value : undefined
  },
})

/**
 * The kinds a reader narrowed the desk to, for this session only.
 *
 * `session` rather than `local`, and that is the whole argument for a second
 * store beside the one above: a filter is a lens for the next ten minutes, and a
 * reader who comes back tomorrow to a desk that is quietly hiding two thirds of
 * their bookings has been lied to by their own tool.
 *
 * Unknown strings survive the guard on purpose — a type this build does not know
 * cannot be selected from the chips it renders, and `filterBookingsByType` simply
 * matches nothing for it.
 */
const BOOK_TYPES_PREFERENCE = defineKeyedPreference<ReadonlyArray<string>>({
  key: 'planned.book-types',
  area: 'session',
  limit: 24,
  fallback: [],
  parse: (raw) => {
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) && value.every((it) => typeof it === 'string')
      ? value
      : undefined
  },
})

/* ------------------------------------------------------------------ screen */

/**
 * What every card on the desk needs and no card decides for itself: the trip it
 * hangs off, how its money and its code are typeset, the day lookup, and the
 * three things a row can be asked to do.
 *
 * One object rather than seven props, because the whole clump travels together
 * from the screen through both panels and every date group before a single card
 * reads any of it — and a card that is handed the desk cannot be handed six
 * sevenths of it by a call site that forgot the seventh.
 */
interface Desk {
  readonly tripId: string
  readonly currency: string
  readonly maskCodes: boolean
  readonly dayById: ReadonlyMap<string, BookingDayOption>
  readonly onEdit: (booking: BookingRow) => void
  readonly onStatus: (booking: BookingRow, next: string) => void
  readonly onDelete: (booking: BookingRow) => void
}

export interface BookingsTimelineProps {
  readonly tripId: string
  readonly bookings: ReadonlyArray<BookingRow>
  readonly days: ReadonlyArray<BookingDayOption>
  readonly currency: string
  /**
   * The reader's own display preference, read by the route beside the desk
   * payload. Required rather than defaulted: a masking flag that can be
   * forgotten at a call site is a masking flag that leaks a code.
   */
  readonly maskCodes: boolean
  readonly newBookingOpen: boolean
  readonly onNewBookingOpenChange: (open: boolean) => void
}

export function BookingsTimeline({
  tripId,
  bookings,
  days,
  currency,
  maskCodes,
  newBookingOpen,
  onNewBookingOpenChange,
}: BookingsTimelineProps) {
  const t = useTranslate()

  const [selectedTypes, setSelectedTypes] = useKeyedPreference(
    BOOK_TYPES_PREFERENCE,
    tripId,
  )
  const [folded, setFolded] = useKeyedPreference(BOOK_GROUPS_PREFERENCE, tripId)
  const [editing, setEditing] = useState<BookingRow | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  const statuses = useOptimistic<BookingStatus>()

  const setStatus = useAction(setBookingStatusFn, {
    failure: t('modules.book.toast.statusFailed'),
    fallback: t('modules.book.toast.statusFailedBody'),
  })
  const remove = useAction(deleteBookingFn, {
    success: t('modules.book.toast.removed'),
    failure: t('modules.book.toast.removeFailed'),
    onSuccess: () => setConfirm(null),
  })

  /** The stored rows with any in-flight status change already painted on. */
  const rendered = useMemo<Array<BookingRow>>(
    () =>
      bookings.map((booking) => {
        const claimed = statuses.get(booking.id)
        return claimed === undefined ? booking : { ...booking, status: claimed }
      }),
    [bookings, statuses],
  )

  /** The chips: only the kinds this trip has, and how many of each. */
  const typeCounts = useMemo(() => countBookingTypes(rendered), [rendered])

  const visible = useMemo(
    () => filterBookingsByType(rendered, selectedTypes),
    [rendered, selectedTypes],
  )
  const panels = useMemo(() => partitionBookings(visible), [visible])
  const dayById = useMemo(
    () => new Map(days.map((day) => [day.id, day])),
    [days],
  )

  function toggleType(type: string): void {
    setSelectedTypes(
      selectedTypes.includes(type)
        ? selectedTypes.filter((it) => it !== type)
        : [...selectedTypes, type],
    )
  }

  function changeStatus(booking: BookingRow, next: string): void {
    if (!isBookingStatus(next) || next === booking.status) {
      return
    }
    void statuses.claim([[booking.id, next]], () =>
      setStatus.run({
        data: { tripId, reservationId: booking.id, status: next },
      }),
    )
  }

  function askToRemove(booking: BookingRow): void {
    setConfirm({
      title: t('modules.remove.confirmTitle', { name: booking.title }),
      description: t('modules.book.remove.body'),
      confirmLabel: t('modules.book.remove.confirm'),
      onConfirm: () =>
        remove.run({ data: { tripId, reservationId: booking.id } }),
    })
  }

  const desk: Desk = {
    tripId,
    currency,
    maskCodes,
    dayById,
    onEdit: setEditing,
    onStatus: changeStatus,
    onDelete: askToRemove,
  }

  if (bookings.length === 0) {
    return (
      <>
        <EmptyState
          variant="dashed"
          size="lg"
          tone="brand"
          icon={<Ticket />}
          title={t('modules.book.empty.title')}
          description={t('modules.book.empty.body')}
          action={
            <Button
              variant="primary"
              shape="pill"
              onClick={() => onNewBookingOpenChange(true)}
            >
              {t('modules.book.empty.action')}
            </Button>
          }
        />
        <BookingDialog
          tripId={tripId}
          days={days}
          currency={currency}
          open={newBookingOpen}
          onOpenChange={onNewBookingOpenChange}
        />
      </>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {typeCounts.length < 2 ? null : (
        <FilterRow>
          {typeCounts.map(({ type, count }) => {
            const Icon = isBookingType(type)
              ? BOOKING_TYPE_ICON[type]
              : BOOKING_TYPE_ICON.other
            return (
              <Chip
                key={type}
                data-part={`type-chip-${type}`}
                selected={selectedTypes.includes(type)}
                count={count}
                icon={<Icon aria-hidden />}
                onClick={() => toggleType(type)}
              >
                {t(bookingTypeLabel(type))}
              </Chip>
            )
          })}
        </FilterRow>
      )}

      {visible.length === 0 ? (
        <EmptyState
          variant="filled"
          size="md"
          icon={<CalendarOff />}
          title={t('modules.book.filtered.title')}
          description={t('modules.book.filtered.body')}
          action={
            <Button
              variant="secondary"
              shape="pill"
              onClick={() => setSelectedTypes([])}
            >
              {t('modules.book.filtered.action')}
            </Button>
          }
        />
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          <SettlementPanel
            id="outstanding"
            title={t('modules.book.panel.outstanding')}
            emptyLine={t('modules.book.panel.outstandingEmpty')}
            bookings={panels.outstanding}
            folded={folded.outstanding}
            onFoldChange={(next) => setFolded({ ...folded, outstanding: next })}
            desk={desk}
          />
          <SettlementPanel
            id="settled"
            title={t('modules.book.panel.settled')}
            emptyLine={t('modules.book.panel.settledEmpty')}
            bookings={panels.settled}
            folded={folded.settled}
            onFoldChange={(next) => setFolded({ ...folded, settled: next })}
            desk={desk}
          />
        </div>
      )}

      <BookingDialog
        tripId={tripId}
        booking={editing ?? undefined}
        days={days}
        currency={currency}
        open={newBookingOpen || editing !== null}
        onOpenChange={(next) => {
          if (!next) {
            setEditing(null)
            onNewBookingOpenChange(false)
          }
        }}
      />

      <ConfirmDialog
        request={confirm}
        pending={remove.pending}
        onOpenChange={(next) => {
          if (!next) {
            setConfirm(null)
          }
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------- one panel */

/**
 * One of the desk's two halves, with its own count and its own disclosure.
 *
 * **The body is mounted and unmounted, never transitioned open.** A height
 * transition is the reflex here and `DESIGN.md` forbids it — "Transform and
 * opacity only. Never animate layout-affecting properties." So the panel's height
 * changes in the single frame the body appears or disappears, and what animates
 * is each row's own entrance: `animate-rise`, the design system's own opacity and
 * `translateY`, staggered 24ms and **capped at eight rows** so a forty-booking
 * panel does not take a second to finish. `data-motion-transform` is what drops
 * the translate for a reader who asked for less motion; the global reduced-motion
 * rule drops the stagger and the chevron's rotation with it.
 *
 * A panel with nothing in it says so on one quiet line rather than rendering an
 * empty box: the count in the header is the answer, and the line beneath it is
 * the reassurance.
 */
function SettlementPanel({
  id,
  title,
  emptyLine,
  bookings,
  folded,
  onFoldChange,
  desk,
}: {
  id: 'settled' | 'outstanding'
  title: string
  emptyLine: string
  bookings: ReadonlyArray<BookingRow>
  folded: boolean
  onFoldChange: (next: boolean) => void
  desk: Desk
}) {
  const groups = useMemo(() => groupBookingsByDate(bookings), [bookings])

  /*
   * Where each date's rows start in the panel's stagger. It runs across the whole
   * panel rather than restarting inside each date, so two rows next to each other
   * on screen are 24ms apart whether or not a date heading sits between them.
   */
  const entranceFrom = useMemo(() => {
    let running = 0
    return groups.map((group) => {
      const at = running
      running += group.bookings.length
      return at
    })
  }, [groups])

  const bodyId = `book-panel-${id}`
  const empty = bookings.length === 0
  const open = !folded && !empty

  return (
    <section className="min-w-0">
      <h2>
        <button
          type="button"
          data-part={`group-toggle-${id}`}
          aria-expanded={open}
          aria-controls={bodyId}
          disabled={empty}
          onClick={() => onFoldChange(!folded)}
          className={cn(
            'flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-start focus-ring',
            'transition-colors duration-fast ease-out-quint',
            empty ? 'cursor-default text-ink-3' : 'text-ink hover:bg-surface-2',
          )}
        >
          <ChevronRight
            aria-hidden
            data-motion-transform=""
            className={cn(
              'size-4 shrink-0 text-ink-4',
              'transition-transform duration-fast ease-out-quint',
              open && 'rotate-90',
              empty && 'opacity-0',
            )}
          />
          <span className="text-label font-semibold">{title}</span>
          <span className="text-caption tabular-nums text-ink-3">
            {bookings.length}
          </span>
        </button>
      </h2>

      {empty ? (
        <p className="px-2 pb-2 ps-8 text-caption text-ink-4">{emptyLine}</p>
      ) : null}

      {open ? (
        <ol id={bodyId} className="flex min-w-0 flex-col pt-1">
          {groups.map((group, index) => (
            <li key={group.date ?? '__undated'} className="min-w-0">
              <TimelineGroup
                group={group}
                first={index === 0}
                last={index === groups.length - 1}
                entranceFrom={entranceFrom[index] ?? 0}
                desk={desk}
              />
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  )
}

/* --------------------------------------------------------------- one group */

function TimelineGroup({
  group,
  first,
  last,
  entranceFrom,
  desk,
}: {
  group: BookingDateGroup
  first: boolean
  last: boolean
  /** Where this date's rows sit in the panel's stagger, so it runs across dates. */
  entranceFrom: number
  desk: Desk
}) {
  const locale = useLocale()
  const t = useTranslate()

  const stamp = group.date === null ? null : stampFor(group.date, locale)

  return (
    <section className="relative grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-x-6">
      {/* The rail: one hairline down the gutter, with a node at each date. It is
          drawn behind the stamp rather than as a border on it, so the first and
          last segments can stop at the node instead of running past it. */}
      <span
        aria-hidden
        className={cn(
          'absolute top-0 bottom-0 start-[1.6875rem] w-px bg-edge sm:start-[2.4375rem]',
          first && 'top-3',
          last && 'bottom-6',
        )}
      />

      <div className="relative z-1 pt-1 pb-6">
        {stamp === null ? (
          <span className="grid size-14 place-items-center rounded-full border border-dashed border-edge-strong bg-canvas text-ink-4 sm:size-20">
            <CalendarOff aria-hidden className="size-5" />
          </span>
        ) : (
          <span className="grid size-14 place-items-center rounded-full border border-edge-faint bg-surface text-center shadow-card sm:size-20">
            <span className="font-display text-label leading-none font-bold tabular-nums text-ink sm:text-subtitle">
              {stamp.dayMonth}
            </span>
            <span className="mt-0.5 text-micro font-semibold tracking-label text-ink-3 uppercase">
              {stamp.weekday}
            </span>
          </span>
        )}
      </div>

      <div className="min-w-0 pt-1 pb-6">
        <h3 className="mb-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="text-label font-semibold text-ink">
            {stamp === null ? t('modules.book.noDate') : stamp.label}
          </span>
          {stamp === null ? (
            <span className="text-caption text-ink-4">
              {t('modules.book.undated')}
            </span>
          ) : (
            <span className="text-caption tabular-nums text-ink-4">
              {stamp.year}
            </span>
          )}
        </h3>

        <ul className="flex min-w-0 flex-col gap-3">
          {group.bookings.map((booking, index) => (
            <li
              key={booking.id}
              data-motion-transform=""
              className="min-w-0 animate-rise"
              // Capped at eight steps: past that the last row is waiting on the
              // list rather than the list waiting on the reader.
              style={{
                animationDelay: `${Math.min(entranceFrom + index, 7) * 24}ms`,
              }}
            >
              <BookingCard booking={booking} desk={desk} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- one card */

function BookingCard({ booking, desk }: { booking: BookingRow; desk: Desk }) {
  const locale = useLocale()
  const t = useTranslate()

  const type = isBookingType(booking.type) ? booking.type : 'other'
  const Icon = BOOKING_TYPE_ICON[type]
  const cancelled = booking.status === 'cancelled'
  const times = timeRange(booking.startTime, booking.endTime)
  /** The itinerary day this booking is pinned to, when it names one that still exists. */
  const day =
    booking.dayId === null ? undefined : desk.dayById.get(booking.dayId)

  const facts: Array<FactItem> = [
    ...(times === null
      ? []
      : [{ label: t('modules.field.time'), value: times }]),
    ...(booking.endDate === null || booking.endDate === booking.startDate
      ? []
      : [
          {
            label: t('modules.book.until'),
            value: formatDate(booking.endDate, locale) ?? booking.endDate,
          },
        ]),
    ...(booking.provider === null
      ? []
      : [{ label: t('modules.book.provider'), value: booking.provider }]),
    ...(booking.location === null
      ? []
      : [{ label: t('modules.book.where'), value: booking.location }]),
    ...(booking.guests === null || booking.guests === 0
      ? []
      : [
          {
            label: t('modules.book.guests'),
            value: (
              <span className="inline-flex items-center gap-1.5">
                <Users aria-hidden className="size-3.5 text-ink-4" />
                {booking.guests}
              </span>
            ),
          },
        ]),
    ...(booking.priceMinor === null || booking.priceMinor === 0
      ? []
      : [
          {
            label: t('modules.field.price'),
            value: formatMoney(
              booking.priceMinor,
              booking.currency ?? desk.currency,
              locale,
            ),
          },
        ]),
    ...(booking.confirmationNumber === null
      ? []
      : [
          {
            label: t('modules.book.confirmation'),
            mono: true,
            value: (
              <MaskedCode
                value={booking.confirmationNumber}
                label={t('modules.book.copyConfirmation', {
                  title: booking.title,
                })}
                masked={desk.maskCodes}
              />
            ),
          },
        ]),
  ]

  return (
    <article
      className={cn(
        'group/card min-w-0 overflow-hidden rounded-xl border border-edge-faint bg-surface shadow-card',
        'transition-[box-shadow,opacity] duration-slow ease-out-quint hover:shadow-elevated',
        cancelled && 'opacity-65',
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-edge-faint px-4 py-3 sm:px-5">
        <span className="inline-flex shrink-0 items-center gap-1.5 text-caption font-medium text-ink-3">
          <Icon aria-hidden className="size-3.5" />
          {t(bookingTypeLabel(type))}
        </span>
        <h4
          className={cn(
            'min-w-0 flex-1 truncate text-label font-semibold text-ink',
            cancelled && 'line-through',
          )}
        >
          {booking.title}
        </h4>
        {booking.importedAt === null ? null : (
          /*
           * "A machine wrote this and no person has looked at it yet." It comes
           * off on the first save of the booking — the server clears the marker
           * inside the same handler — so reviewing it is the review, and there is
           * no second control here to tick.
           */
          <Badge
            tone="warning"
            size="sm"
            data-part="import-marker"
            title={t('modules.book.import.hint')}
          >
            {t('modules.book.import.badge')}
          </Badge>
        )}
        <StatusPill
          status={booking.status}
          title={booking.title}
          onSelect={(next) => desk.onStatus(booking, next)}
        />
        <RowMenu
          label={t('modules.actionsFor', { name: booking.title })}
          items={[
            {
              label: t('modules.book.menu.edit'),
              icon: <Pencil aria-hidden />,
              onSelect: () => desk.onEdit(booking),
            },
            ...(booking.url === null
              ? []
              : [
                  {
                    label: t('modules.book.menu.open'),
                    icon: <ExternalLink aria-hidden />,
                    onSelect: () => {
                      window.open(
                        booking.url ?? '',
                        '_blank',
                        'noopener,noreferrer',
                      )
                    },
                  },
                ]),
            {
              label: t('modules.book.remove.confirm'),
              icon: <Trash2 aria-hidden />,
              tone: 'danger' as const,
              separated: true,
              onSelect: () => desk.onDelete(booking),
            },
          ]}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-4 px-4 py-4 sm:px-5">
        {facts.length === 0 ? (
          <p className="text-caption text-ink-4">
            {t('modules.book.emptyFacts')}
          </p>
        ) : (
          <FactList items={facts} columns={facts.length > 4 ? 4 : 3} />
        )}

        {booking.notes === null ? null : (
          <FactNote label={t('modules.field.notes')}>{booking.notes}</FactNote>
        )}

        {day === undefined ? null : (
          <p className="inline-flex items-center gap-1.5 text-caption text-ink-3">
            <Link2 aria-hidden className="size-3.5 text-ink-4" />
            {t('modules.book.onItinerary', { day: dayLabel(day, t) })}
          </p>
        )}

        {/*
          One record, one home. A booking of the transport kind is not copied
          into the transports tab and a journey is not copied into this desk —
          this is the quiet link between the two, so a reader can walk from the
          ticket to the journey in one click without either list pretending to
          own the other's row.
        */}
        {booking.transportId === null ? null : (
          <Link
            to="/trips/$tripId/transports"
            params={{ tripId: desk.tripId }}
            data-part="journey-link"
            className="inline-flex w-fit items-center gap-1.5 rounded-sm text-caption text-ink-3 focus-ring transition-colors duration-fast ease-out-quint hover:text-brand"
          >
            <RouteIcon aria-hidden className="size-3.5 text-ink-4" />
            {t('modules.book.journeyLink')}
          </Link>
        )}

        {booking.url === null ? null : (
          <div>
            <Button asChild variant="secondary" size="sm" shape="pill">
              <a href={booking.url} target="_blank" rel="noreferrer noopener">
                {t('modules.book.menu.open')}
                <ExternalLink aria-hidden />
              </a>
            </Button>
          </div>
        )}
      </div>
    </article>
  )
}

function StatusPill({
  status,
  title,
  onSelect,
}: {
  status: string
  title: string
  onSelect: (next: string) => void
}) {
  const t = useTranslate()

  return (
    <StatusMenu
      current={statusOption(status, t)}
      options={statusOptions(t)}
      label={t('modules.statusOf', { title })}
      onSelect={onSelect}
    />
  )
}
