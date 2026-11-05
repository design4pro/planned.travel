import * as React from 'react'
import { CalendarDays, ChevronDown, ChevronUp, X } from 'lucide-react'
import {
  Badge,
  Button,
  GlassPanel,
  IconButton,
  Skeleton,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import {
  formatDate,
  formatNumber,
  formatTimeRange,
  weekdayName,
} from '#/lib/format'
import { useLocale, useTranslate } from '#/lib/i18n'
import { Markdown } from '#/lib/markdown/render'
import {
  dayNoteIconGlyph,
  dayNoteIconLabel,
} from '#/components/planner/note-row'
import {
  bookingTypeLabel,
  isBookingStatus,
} from '#/components/modules/book/booking-form'
import { RESERVATION_STATUS_TONE } from '../../../-lib/tone'
import type { DayDetailModel } from './day-detail-model'

export interface DayDetailProps {
  readonly model: DayDetailModel
  readonly tripId: string
  readonly compact?: boolean
  readonly controls?: React.ReactNode
  readonly minimised: boolean
  readonly editable: boolean
  readonly loading: boolean
  readonly error: boolean
  readonly focusToken: number
  readonly blockedEscape: boolean
  readonly panelRef: React.RefObject<HTMLDivElement | null>
  readonly addStayRef: React.RefObject<HTMLButtonElement | null>
  readonly onMinimise: () => void
  readonly onExpand: () => void
  readonly onClose: () => void
  readonly onAddStay: () => void
  readonly onRetry: () => void
}

export function DayDetail({
  model,
  tripId,
  compact = false,
  controls,
  minimised,
  editable,
  loading,
  error,
  focusToken,
  blockedEscape,
  panelRef,
  addStayRef,
  onMinimise,
  onExpand,
  onClose,
  onAddStay,
  onRetry,
}: DayDetailProps) {
  const t = useTranslate()
  const locale = useLocale()
  const heading = React.useRef<HTMLHeadingElement>(null)
  const addStayFocused = React.useRef(false)
  React.useLayoutEffect(() => {
    if (
      model.stays.length > 0 &&
      addStayFocused.current &&
      document.activeElement === document.body
    ) {
      addStayFocused.current = false
      heading.current?.focus()
    }
  }, [model.stays.length])
  const expand = React.useRef<HTMLButtonElement>(null)
  const headingId = React.useId()
  const dayName = t('atlas.map.pin.day', {
    day: formatNumber(model.day.dayNumber, locale),
  })
  const date = model.day.date
  React.useEffect(() => {
    const timer = window.setTimeout(() => heading.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [focusToken])
  return (
    <GlassPanel
      ref={panelRef}
      role="region"
      aria-label={t('trips.plan.dayDetail.label', { day: dayName })}
      aria-labelledby={headingId}
      data-day-detail=""
      data-weather-integration="day-weather-panel"
      padding="none"
      className={cn(
        'absolute z-30 mx-auto flex max-h-1/2 max-w-3xl flex-col overflow-hidden rounded-2xl',
        !minimised && 'h-1/2',
        compact
          ? 'start-3 end-(--plan-controls-clearance) bottom-3'
          : 'inset-x-3 bottom-(--plan-bar) lg:start-[calc(var(--plan-left)+2rem)] lg:end-(--plan-controls-clearance) lg:bottom-4',
      )}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || event.defaultPrevented || blockedEscape)
          return
        if (
          event.target instanceof HTMLElement &&
          event.target.closest(
            'input, textarea, [contenteditable="true"], [role="dialog"], [role="menu"], [data-radix-popper-content-wrapper]',
          )
        )
          return
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }}
    >
      <header
        className={cn(
          'flex shrink-0 items-center gap-2 border-b border-glass-edge px-3 py-2',
          compact && 'flex-wrap gap-x-1 gap-y-0 py-1',
        )}
      >
        <CalendarDays
          aria-hidden="true"
          size={18}
          className="shrink-0 text-brand"
        />
        <div className={compact ? 'contents' : 'min-w-0 flex-1'}>
          <h2
            id={headingId}
            ref={heading}
            tabIndex={compact && minimised ? 0 : -1}
            className={cn(
              'font-display text-label font-bold text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
              compact && minimised
                ? 'order-last max-h-10 basis-full overflow-y-auto [overflow-wrap:anywhere]'
                : 'truncate',
              compact && !minimised && 'min-w-0 flex-1',
            )}
          >
            {dayName}
            {model.day.title ? (
              <>
                {' · '}
                <bdi dir="auto">{model.day.title}</bdi>
              </>
            ) : null}
          </h2>
          <p
            className={cn(
              'text-caption text-ink-3',
              compact && 'order-last basis-full',
            )}
          >
            {date === null
              ? t('trips.plan.dayDetail.undated')
              : `${weekdayName(new Date(`${date}T12:00:00Z`).getUTCDay(), locale, 'long')}, ${formatDate(date, locale)}`}
          </p>
        </div>
        {controls}
        {minimised ? (
          <IconButton
            ref={expand}
            label={t('trips.plan.dayDetail.expand')}
            icon={<ChevronUp />}
            onClick={onExpand}
          />
        ) : (
          <IconButton
            label={t('trips.plan.dayDetail.minimise')}
            icon={<ChevronDown />}
            onClick={() => {
              onMinimise()
              requestAnimationFrame(() => expand.current?.focus())
            }}
          />
        )}
        <IconButton
          label={t('trips.plan.dayDetail.close')}
          icon={<X />}
          onClick={onClose}
        />
      </header>
      {minimised ? null : (
        <div
          role="group"
          aria-labelledby={headingId}
          tabIndex={0}
          className={cn(
            'min-h-0 overflow-y-auto overscroll-contain p-3 [scrollbar-gutter:stable] text-caption text-ink-2 [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
            compact && 'py-1',
          )}
        >
          {compact && model.day.title ? (
            <p aria-hidden="true" dir="auto" className="mb-2 text-ink">
              {model.day.title}
            </p>
          ) : null}
          <section aria-labelledby={`${headingId}-stays`} className="min-h-24">
            <h3
              id={`${headingId}-stays`}
              className="mb-2 font-semibold text-ink"
            >
              {t('trips.plan.dayDetail.stays')}
            </h3>
            {model.stays.length === 0 ? (
              <div className="rounded-xl border border-dashed border-edge p-3">
                <p>{t('trips.plan.dayDetail.noStay')}</p>
                {editable ? (
                  <Button
                    ref={addStayRef}
                    onFocus={() => {
                      addStayFocused.current = true
                    }}
                    onBlur={() => {
                      addStayFocused.current = false
                    }}
                    size="sm"
                    variant="secondary"
                    className="mt-2"
                    onClick={onAddStay}
                  >
                    {t('trips.plan.dayDetail.addStay')}
                  </Button>
                ) : null}
              </div>
            ) : (
              <ul className="space-y-2">
                {model.stays.map((stay) => (
                  <li key={stay.id} className="rounded-xl bg-surface-inset p-3">
                    <p className="font-semibold text-ink">{stay.name}</p>
                    {stay.checkIn === null ? null : (
                      <p>
                        {t('trips.plan.stay.checkIn')} · {stay.checkIn}
                      </p>
                    )}
                    {stay.checkOut === null ? null : (
                      <p>
                        {t('trips.plan.stay.checkOut')} · {stay.checkOut}
                      </p>
                    )}
                    <div className="min-h-5">
                      {loading && stay.confirmation === null ? (
                        <Skeleton className="h-4 w-32" />
                      ) : (
                        <p>
                          {stay.confirmation ??
                            (error
                              ? t('trips.plan.dayDetail.readError')
                              : t('trips.plan.dayDetail.noConfirmation'))}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section
            aria-labelledby={`${headingId}-notes`}
            className="mt-4 min-h-16"
          >
            <h3
              id={`${headingId}-notes`}
              className="mb-2 font-semibold text-ink"
            >
              {t('trips.plan.dayDetail.notes')}
            </h3>
            {model.notes.length === 0 ? (
              <p className="text-ink-3">{t('trips.plan.dayDetail.noNotes')}</p>
            ) : (
              <ul className="space-y-3">
                {model.notes.map((note) => {
                  const Glyph = dayNoteIconGlyph(note.icon)
                  return (
                    <li key={note.id} className="flex gap-2">
                      <span
                        role="img"
                        aria-label={t(dayNoteIconLabel(note.icon))}
                      >
                        <Glyph size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p>
                          {note.time === null ? null : (
                            <time className="me-2 font-semibold">
                              {note.time}
                            </time>
                          )}
                          {note.body}
                        </p>
                        {note.detail ? (
                          <Markdown
                            text={note.detail}
                            className="mt-1 text-caption"
                          />
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
          <section
            aria-labelledby={`${headingId}-reservations`}
            className="mt-4 min-h-24"
            aria-busy={loading}
          >
            <h3
              id={`${headingId}-reservations`}
              className="mb-2 font-semibold text-ink"
            >
              {t('trips.plan.dayDetail.reservations')}
            </h3>
            {error ? (
              <div role="alert">
                <p>{t('trips.plan.dayDetail.readError')}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    onRetry()
                    heading.current?.focus()
                  }}
                >
                  {t('trips.plan.dayDetail.retry')}
                </Button>
              </div>
            ) : null}
            {loading && model.reservations.length === 0 ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
              </div>
            ) : null}
            {!loading && !error && model.reservations.length === 0 ? (
              <p className="text-ink-3">
                {t('trips.plan.dayDetail.noReservations')}
              </p>
            ) : null}
            <ul className="space-y-2">
              {model.reservations.map((row) => {
                const status = isBookingStatus(row.status) ? row.status : 'none'
                return (
                  <li key={row.id} className="rounded-xl bg-surface-inset p-3">
                    <a
                      href={`/trips/${encodeURIComponent(tripId)}/book`}
                      className="font-semibold text-brand underline underline-offset-2"
                    >
                      {row.title}
                    </a>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span>{t(bookingTypeLabel(row.type))}</span>
                      <Badge size="sm" tone={RESERVATION_STATUS_TONE[status]}>
                        {t(`modules.book.status.${status}`)}
                      </Badge>
                    </div>
                    {row.location ? <p>{row.location}</p> : null}
                    {row.startTime || row.endTime ? (
                      <p>
                        {formatTimeRange(row.startTime, row.endTime, locale)}
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      )}
    </GlassPanel>
  )
}
