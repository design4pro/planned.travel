/**
 * The bookings screen, laid out as the trip's timeline.
 *
 * Bookings are not a table of rows: they are things that happen on days, so the
 * screen is grouped by date with a rail down the left, a date stamp at each
 * junction and the day's bookings hanging off it. Undated bookings collect at the
 * end under their own heading rather than being scattered through the dates with
 * a blank where the date should be.
 *
 * Every card is live: the status pill is the control that changes the status, the
 * confirmation number copies itself, and the overflow menu edits, re-attaches or
 * removes the booking. Stored values are typeset as facts, never as filled boxes
 * that read like disabled inputs.
 */
import { useMemo, useState } from 'react'
import {
  CalendarOff,
  ExternalLink,
  Link2,
  Pencil,
  Ticket,
  Trash2,
  Users,
} from 'lucide-react'

import { Button, Chip, EmptyState } from '#/components/ui'
import { cn } from '#/lib/cn'
import { formatWeekday } from '#/lib/format'
import { formatMoney } from '#/lib/money'
import { useLocale, useTranslate } from '#/lib/i18n'

import type { Locale, MessageKey, Translate } from '#/lib/i18n'
import { deleteBookingFn, setBookingStatusFn } from '#/server/fns/reservations'
import {
  ConfirmDialog,
  CopyValue,
  FactList,
  FactNote,
  FilterRow,
  RowMenu,
  StatusMenu,
  useAction,
  useOptimistic,
} from '../shared'
import { BOOKING_TYPE_ICON, BookingDialog, dayLabel } from './booking-dialog'
import { groupBookingsByDate } from './grouping'
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
 * The date stamp beside a group, split into the weekday line and the year under
 * it. Both come out of `format.ts`, which reads an ISO day in UTC for the reason
 * the costs module records: a calendar date read in the browser's zone moves half
 * a Tokyo trip to the previous day for a reader in London.
 */
function stampFor(
  date: string,
  locale: Locale,
): {
  readonly label: string
  readonly year: string
} {
  const label = formatWeekday(date, locale)
  if (label === null) {
    return { label: date, year: '' }
  }
  return { label, year: date.slice(0, 4) }
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

/* ------------------------------------------------------------------ screen */

export interface BookingsTimelineProps {
  readonly tripId: string
  readonly bookings: ReadonlyArray<BookingRow>
  readonly days: ReadonlyArray<BookingDayOption>
  readonly currency: string
  readonly newBookingOpen: boolean
  readonly onNewBookingOpenChange: (open: boolean) => void
}

type StatusFilter = 'all' | BookingStatus

export function BookingsTimeline({
  tripId,
  bookings,
  days,
  currency,
  newBookingOpen,
  onNewBookingOpenChange,
}: BookingsTimelineProps) {
  const t = useTranslate()

  const [filter, setFilter] = useState<StatusFilter>('all')
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

  const counts = useMemo(() => {
    const tally = new Map<string, number>()
    for (const booking of rendered) {
      tally.set(booking.status, (tally.get(booking.status) ?? 0) + 1)
    }
    return tally
  }, [rendered])

  const visible = rendered.filter(
    (booking) => filter === 'all' || booking.status === filter,
  )
  const groups = useMemo(() => groupBookingsByDate(visible), [visible])
  const dayById = useMemo(
    () => new Map(days.map((day) => [day.id, day])),
    [days],
  )

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
      <FilterRow>
        <Chip
          selected={filter === 'all'}
          count={rendered.length}
          onClick={() => setFilter('all')}
        >
          {t('modules.filter.all')}
        </Chip>
        {BOOKING_STATUSES.filter((status) => (counts.get(status) ?? 0) > 0).map(
          (status) => (
            <Chip
              key={status}
              selected={filter === status}
              count={counts.get(status) ?? 0}
              onClick={() => setFilter(status)}
            >
              {t(STATUS_LABEL[status])}
            </Chip>
          ),
        )}
      </FilterRow>

      {visible.length === 0 ? (
        <EmptyState
          variant="filled"
          size="md"
          icon={<CalendarOff />}
          title={t('modules.book.filtered.title')}
          description={t('modules.book.filtered.body', {
            label: t('modules.filter.all'),
          })}
          action={
            <Button
              variant="secondary"
              shape="pill"
              onClick={() => setFilter('all')}
            >
              {t('modules.book.filtered.action')}
            </Button>
          }
        />
      ) : (
        <ol className="flex min-w-0 flex-col">
          {groups.map((group, index) => (
            <li key={group.date ?? '__undated'} className="min-w-0">
              <TimelineGroup
                group={group}
                first={index === 0}
                last={index === groups.length - 1}
                currency={currency}
                dayById={dayById}
                onEdit={setEditing}
                onStatus={changeStatus}
                onDelete={(booking) =>
                  setConfirm({
                    title: t('modules.remove.confirmTitle', {
                      name: booking.title,
                    }),
                    description: t('modules.book.remove.body'),
                    confirmLabel: t('modules.book.remove.confirm'),
                    onConfirm: () =>
                      remove.run({
                        data: { tripId, reservationId: booking.id },
                      }),
                  })
                }
              />
            </li>
          ))}
        </ol>
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

/* --------------------------------------------------------------- one group */

function TimelineGroup({
  group,
  first,
  last,
  currency,
  dayById,
  onEdit,
  onStatus,
  onDelete,
}: {
  group: BookingDateGroup
  first: boolean
  last: boolean
  currency: string
  dayById: ReadonlyMap<string, BookingDayOption>
  onEdit: (booking: BookingRow) => void
  onStatus: (booking: BookingRow, next: string) => void
  onDelete: (booking: BookingRow) => void
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
              {stamp.label.split(' ').slice(1).join(' ')}
            </span>
            <span className="mt-0.5 text-micro font-semibold tracking-label text-ink-3 uppercase">
              {stamp.label.split(' ')[0]?.replace(',', '')}
            </span>
          </span>
        )}
      </div>

      <div className="min-w-0 pt-1 pb-6">
        <h2 className="mb-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
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
        </h2>

        <ul className="flex min-w-0 flex-col gap-3">
          {group.bookings.map((booking) => (
            <li key={booking.id} className="min-w-0">
              <BookingCard
                booking={booking}
                currency={currency}
                day={
                  booking.dayId === null
                    ? undefined
                    : dayById.get(booking.dayId)
                }
                onEdit={() => onEdit(booking)}
                onStatus={(next) => onStatus(booking, next)}
                onDelete={() => onDelete(booking)}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- one card */

function BookingCard({
  booking,
  currency,
  day,
  onEdit,
  onStatus,
  onDelete,
}: {
  booking: BookingRow
  currency: string
  day: BookingDayOption | undefined
  onEdit: () => void
  onStatus: (next: string) => void
  onDelete: () => void
}) {
  const t = useTranslate()
  const locale = useLocale()

  const type = isBookingType(booking.type) ? booking.type : 'other'
  const Icon = BOOKING_TYPE_ICON[type]
  const cancelled = booking.status === 'cancelled'
  const times = timeRange(booking.startTime, booking.endTime)

  const facts: Array<FactItem> = [
    ...(times === null
      ? []
      : [{ label: t('modules.field.time'), value: times }]),
    ...(booking.endDate === null || booking.endDate === booking.startDate
      ? []
      : [
          {
            label: t('modules.book.until'),
            value: stampFor(booking.endDate, locale).label,
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
              booking.currency ?? currency,
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
              <CopyValue
                value={booking.confirmationNumber}
                label={t('modules.book.copyConfirmation', {
                  title: booking.title,
                })}
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
        <h3
          className={cn(
            'min-w-0 flex-1 truncate text-label font-semibold text-ink',
            cancelled && 'line-through',
          )}
        >
          {booking.title}
        </h3>
        <StatusPill
          status={booking.status}
          title={booking.title}
          onSelect={onStatus}
        />
        <RowMenu
          label={t('modules.actionsFor', { name: booking.title })}
          items={[
            {
              label: t('modules.book.menu.edit'),
              icon: <Pencil aria-hidden />,
              onSelect: onEdit,
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
              onSelect: onDelete,
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
