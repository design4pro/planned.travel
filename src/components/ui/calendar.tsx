import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'

import { cn } from '#/lib/cn'
import { formatList, formatNumber, monthName, weekdayName } from '#/lib/format'
import { IconButton } from './icon-button'
import { useUiCopy, useUiI18n } from './copy'
import { focusRing, transitionBase, useControllableState } from './shared'

import type { UiI18n } from './copy'

/**
 * Month and weekday names come from the frozen CLDR tables in
 * `src/lib/format-tables.ts`, never from a live `Intl` call and never from
 * `date-fns`' English defaults. `docs/SPEC.md` §8.5 is explicit about why: this
 * grid is rendered first in workerd and then hydrated in the traveller's
 * browser, and the two runtimes disagree about several of these names — Greek
 * inflects a bare month differently, and Arabic, Catalan and Russian disagree
 * about abbreviated weekdays. A disagreement here is a hydration error on a
 * screen that looked perfect in Chrome.
 *
 * The *order* of the parts is catalogue copy rather than table data, so
 * `ui.calendar.monthYear` and `ui.calendar.day` carry patterns a translator can
 * reorder into `2026年3月` without anybody inventing a month name.
 */

/**
 * A local calendar day as the `YYYY-MM-DD` column `src/lib/format.ts` parses.
 *
 * The formatters there read a date with UTC getters, because every date this
 * product stores is a calendar day rather than an instant. A `Date` picked out
 * of this grid is local midnight, so handing it over directly would move a
 * September evening in Tokyo into the previous day. Writing the local
 * year/month/day out as the column form is the conversion, and it is the only
 * one either picker needs.
 */
export function isoDay(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** `March 2026`, `marzec 2026`, `2026年3月` — the table's name, the catalogue's order. */
function monthHeading(month: Date, ui: UiI18n): string {
  return ui.t('ui.calendar.monthYear', {
    month: monthName(month.getMonth(), ui.locale, 'long') ?? '',
    year: String(month.getFullYear()),
  })
}

/** A half-open selection: `to` is absent while the reader is mid-pick. */
export type DateRange = { from: Date; to?: Date }

export type CalendarBaseProps = {
  /** Controlled visible month. */
  month?: Date
  defaultMonth?: Date
  onMonthChange?: (month: Date) => void
  /** Two months side by side on wide viewports — the range-picking default. */
  numberOfMonths?: 1 | 2
  minDate?: Date
  maxDate?: Date
  /** Per-day veto: blackout dates, sold-out nights, days before a flight. */
  isDateDisabled?: (date: Date) => boolean
  /** 0 = Sunday, 1 = Monday. */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
  /** Days that carry content get a dot under the numeral. */
  markedDates?: Array<Date>
  /** Content under the grid — presets, a night count, a legend. */
  footer?: React.ReactNode
  className?: string
}

type InternalProps = CalendarBaseProps & {
  mode: 'single' | 'range'
  range: DateRange | null
  onDayPick: (date: Date) => void
  /** Announced as the grid's accessible name. */
  label: string
}

const dayBase = [
  'relative grid size-9 place-items-center rounded-full text-label tabular-nums',
  transitionBase,
  focusRing,
]

function isDayDisabled(date: Date, props: CalendarBaseProps): boolean {
  if (props.minDate && isBefore(date, startOfDay(props.minDate))) return true
  if (props.maxDate && isAfter(date, startOfDay(props.maxDate))) return true
  return props.isDateDisabled?.(date) ?? false
}

/** Every day rendered by one month grid, padded out to whole weeks. */
function daysOfMonthGrid(
  month: Date,
  weekStartsOn: CalendarBaseProps['weekStartsOn'],
) {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn }),
  })
}

function CalendarGrid({
  month,
  focusedDate,
  hoveredDate,
  onHover,
  registerDay,
  ui,
  ...props
}: InternalProps & {
  month: Date
  focusedDate: Date
  hoveredDate: Date | null
  onHover: (date: Date | null) => void
  registerDay: (key: string, node: HTMLButtonElement | null) => void
  ui: UiI18n
}) {
  const { mode, range, onDayPick, weekStartsOn = 1, markedDates } = props
  const days = daysOfMonthGrid(month, weekStartsOn)
  const weeks: Array<Array<Date>> = []
  for (let index = 0; index < days.length; index += 7)
    weeks.push(days.slice(index, index + 7))

  const start = range?.from ?? null
  const end = range?.to ?? null
  // While only one end is committed, the hovered day stands in for the other,
  // so the reader sees the nights they are about to book before they commit.
  const previewEnd =
    mode === 'range' && start && !end && hoveredDate ? hoveredDate : end

  const inRange = (date: Date) => {
    if (!start || !previewEnd) return false
    const [low, high] = isAfter(previewEnd, start)
      ? [start, previewEnd]
      : [previewEnd, start]
    return !isBefore(date, startOfDay(low)) && !isAfter(date, startOfDay(high))
  }

  return (
    <div className="min-w-0">
      <table
        role="grid"
        aria-label={ui.t('ui.calendar.grid', {
          month: monthHeading(month, ui),
          label: props.label,
        })}
        className="w-full border-collapse"
      >
        <thead>
          <tr>
            {(weeks[0] ?? []).map((day) => (
              <th
                key={day.toISOString()}
                scope="col"
                abbr={weekdayName(day.getDay(), ui.locale, 'long') ?? undefined}
                className="px-1 pb-1.5 text-micro font-semibold uppercase tracking-label whitespace-nowrap text-ink-4"
              >
                {weekdayName(day.getDay(), ui.locale, 'short')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]?.toISOString()}>
              {week.map((day) => {
                const outside = !isSameMonth(day, month)
                const disabled = isDayDisabled(day, props)
                const isStart = start ? isSameDay(day, start) : false
                const isEnd = previewEnd ? isSameDay(day, previewEnd) : false
                const selected = mode === 'single' ? isStart : isStart || isEnd
                const between = mode === 'range' && !selected && inRange(day)
                const marked =
                  markedDates?.some((marker) => isSameDay(marker, day)) ?? false
                const today = isToday(day)
                const key = day.toISOString()

                return (
                  <td
                    key={key}
                    role="gridcell"
                    aria-selected={selected || between}
                    className={cn(
                      'p-0 text-center',
                      // The connecting wash sits on the cell, not the button, so
                      // a range reads as one continuous band across the week.
                      between && 'bg-brand-subtle',
                      mode === 'range' &&
                        isStart &&
                        previewEnd &&
                        !isEnd &&
                        'rounded-s-full bg-brand-subtle',
                      mode === 'range' &&
                        isEnd &&
                        start &&
                        !isStart &&
                        'rounded-e-full bg-brand-subtle',
                    )}
                  >
                    <button
                      type="button"
                      ref={(node) => registerDay(key, node)}
                      tabIndex={isSameDay(day, focusedDate) ? 0 : -1}
                      disabled={disabled}
                      aria-current={today ? 'date' : undefined}
                      aria-label={ui.t('ui.calendar.day', {
                        weekday:
                          weekdayName(day.getDay(), ui.locale, 'long') ?? '',
                        day: formatNumber(day.getDate(), ui.locale),
                        month:
                          monthName(day.getMonth(), ui.locale, 'long') ?? '',
                        year: String(day.getFullYear()),
                      })}
                      onClick={() => onDayPick(day)}
                      onPointerEnter={() => onHover(day)}
                      onFocus={() => onHover(day)}
                      className={cn(
                        dayBase,
                        'mx-auto',
                        outside && 'text-ink-4/70',
                        !outside && !selected && 'text-ink-2',
                        !disabled &&
                          !selected &&
                          'hover:bg-hover hover:text-ink',
                        selected &&
                          'bg-accent font-semibold text-accent-on hover:bg-accent-hover',
                        between && 'text-ink',
                        today && !selected && 'font-semibold text-brand',
                        disabled &&
                          'cursor-not-allowed text-ink-4/50 line-through decoration-1',
                      )}
                    >
                      {formatNumber(day.getDate(), ui.locale)}
                      {marked && !selected ? (
                        <span
                          className="absolute bottom-1 size-1 rounded-full bg-brand"
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CalendarBase(props: InternalProps) {
  const {
    className,
    mode,
    range,
    onDayPick,
    label,
    month,
    defaultMonth,
    onMonthChange,
    numberOfMonths = 1,
    footer,
    weekStartsOn = 1,
  } = props

  const ui = useUiI18n()

  const [visibleMonth, setVisibleMonth] = useControllableState<Date>({
    value: month,
    defaultValue: startOfMonth(defaultMonth ?? range?.from ?? new Date()),
    onChange: onMonthChange,
  })

  const [focusedDate, setFocusedDate] = React.useState<Date>(
    () => range?.from ?? startOfMonth(visibleMonth),
  )
  const [hoveredDate, setHoveredDate] = React.useState<Date | null>(null)
  const dayNodes = React.useRef(new Map<string, HTMLButtonElement>())
  const pendingFocus = React.useRef(false)

  const registerDay = React.useCallback(
    (key: string, node: HTMLButtonElement | null) => {
      if (node) dayNodes.current.set(key, node)
      else dayNodes.current.delete(key)
    },
    [],
  )

  // Focus follows the roving date only in response to a key press — never on a
  // render, which would otherwise steal focus from the trigger on open.
  React.useEffect(() => {
    if (!pendingFocus.current) return
    pendingFocus.current = false
    dayNodes.current.get(focusedDate.toISOString())?.focus()
  }, [focusedDate])

  const moveFocus = (next: Date) => {
    pendingFocus.current = true
    setFocusedDate(next)
    const firstVisible = startOfMonth(visibleMonth)
    const lastVisible = endOfMonth(addMonths(visibleMonth, numberOfMonths - 1))
    if (isBefore(next, firstVisible)) setVisibleMonth(startOfMonth(next))
    else if (isAfter(next, lastVisible))
      setVisibleMonth(startOfMonth(addMonths(next, 1 - numberOfMonths)))
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // The horizontal arrows follow the reading direction, not the screen: in an
    // RTL grid the next day sits to the *left* of today, so ArrowLeft advances.
    // Vertical movement is a week either way — rows stack downwards in every
    // script this product ships.
    const forward = ui.dir === 'rtl' ? -1 : 1
    const moves: Record<string, number | undefined> = {
      ArrowLeft: -forward,
      ArrowRight: forward,
      ArrowUp: -7,
      ArrowDown: 7,
    }
    const delta = moves[event.key]
    if (delta !== undefined) {
      event.preventDefault()
      moveFocus(addDays(focusedDate, delta))
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const week =
        event.key === 'Home'
          ? startOfWeek(focusedDate, { weekStartsOn })
          : endOfWeek(focusedDate, { weekStartsOn })
      moveFocus(week)
      return
    }
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      moveFocus(addMonths(focusedDate, event.key === 'PageUp' ? -1 : 1))
    }
  }

  const shiftMonth = (delta: number) =>
    setVisibleMonth(addMonths(visibleMonth, delta))

  const canGoBack =
    !props.minDate ||
    isAfter(startOfMonth(visibleMonth), startOfMonth(props.minDate))
  const canGoForward =
    !props.maxDate ||
    isBefore(
      endOfMonth(addMonths(visibleMonth, numberOfMonths - 1)),
      startOfMonth(props.maxDate),
    )

  const months = Array.from({ length: numberOfMonths }, (_, index) =>
    addMonths(visibleMonth, index),
  )

  return (
    <div
      className={cn('select-none', className)}
      onKeyDown={handleKeyDown}
      onPointerLeave={() => setHoveredDate(null)}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <IconButton
          icon={<ChevronLeft data-mirror-rtl />}
          label={ui.t('ui.calendar.previousMonth')}
          size="sm"
          variant="ghost"
          disabled={!canGoBack}
          onClick={() => shiftMonth(-1)}
        />
        <div className="flex flex-1 items-center justify-around gap-4">
          {months.map((current) => (
            <span
              key={current.toISOString()}
              className="text-label font-semibold text-ink"
              aria-hidden="true"
            >
              {monthHeading(current, ui)}
            </span>
          ))}
        </div>
        <IconButton
          icon={<ChevronRight data-mirror-rtl />}
          label={ui.t('ui.calendar.nextMonth')}
          size="sm"
          variant="ghost"
          disabled={!canGoForward}
          onClick={() => shiftMonth(1)}
        />
      </div>

      {/* The visible month is announced once, politely — a reader paging through
          months hears "March 2026" rather than forty-two day names. */}
      <span role="status" aria-live="polite" className="sr-only">
        {ui.t('ui.calendar.showing', {
          months: formatList(
            months.map((current) => monthHeading(current, ui)),
            ui.locale,
          ),
        })}
      </span>

      <div
        className={cn(
          'flex gap-6',
          numberOfMonths === 2 && 'flex-col sm:flex-row',
        )}
      >
        {months.map((current) => (
          <CalendarGrid
            key={current.toISOString()}
            {...props}
            month={current}
            focusedDate={focusedDate}
            hoveredDate={hoveredDate}
            onHover={setHoveredDate}
            registerDay={registerDay}
            ui={ui}
            onDayPick={(date) => {
              setFocusedDate(date)
              onDayPick(date)
            }}
            label={label}
            mode={mode}
            range={range}
          />
        ))}
      </div>

      {footer ? (
        <div className="mt-3 border-t border-edge-faint pt-3">{footer}</div>
      ) : null}
    </div>
  )
}

export type CalendarProps = CalendarBaseProps & {
  selected?: Date | null
  onSelect?: (date: Date) => void
  /** Accessible name for the grid. */
  label?: string
}

/**
 * A single-date month grid. Arrow keys walk days, Page keys walk months,
 * Home/End jump to the ends of a week, and the roving tabindex means the whole
 * calendar is one tab stop.
 */
export const Calendar = React.forwardRef<HTMLDivElement, CalendarProps>(
  ({ selected, onSelect, label, ...props }, ref) => {
    const t = useUiCopy()
    return (
      <div ref={ref}>
        <CalendarBase
          {...props}
          mode="single"
          label={label ?? t('ui.calendar.label.date')}
          range={selected ? { from: selected, to: selected } : null}
          onDayPick={(date) => onSelect?.(date)}
        />
      </div>
    )
  },
)
Calendar.displayName = 'Calendar'

export type RangeCalendarProps = CalendarBaseProps & {
  selected?: DateRange | null
  onSelect?: (range: DateRange | null) => void
  label?: string
}

/**
 * The two-ended version. The first click sets the start and clears the end, the
 * second completes the range, and clicking before the start restarts from there
 * — the behaviour every hotel search has taught people to expect.
 */
export const RangeCalendar = React.forwardRef<
  HTMLDivElement,
  RangeCalendarProps
>(({ selected, onSelect, label, numberOfMonths = 2, ...props }, ref) => {
  const t = useUiCopy()
  const [range, setRange] = useControllableState<DateRange | null>({
    value: selected,
    defaultValue: null,
    onChange: onSelect,
  })

  const pick = (date: Date) => {
    if (!range || range.to || isBefore(date, range.from)) {
      setRange({ from: date })
      return
    }
    setRange({ from: range.from, to: date })
  }

  return (
    <div ref={ref}>
      <CalendarBase
        {...props}
        mode="range"
        label={label ?? t('ui.calendar.label.range')}
        numberOfMonths={numberOfMonths}
        range={range}
        onDayPick={pick}
      />
    </div>
  )
})
RangeCalendar.displayName = 'RangeCalendar'
