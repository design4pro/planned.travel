import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
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
import { IconButton } from './icon-button'
import { focusRing, transitionBase, useControllableState } from './shared'

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
  ...props
}: InternalProps & {
  month: Date
  focusedDate: Date
  hoveredDate: Date | null
  onHover: (date: Date | null) => void
  registerDay: (key: string, node: HTMLButtonElement | null) => void
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
        aria-label={`${format(month, 'MMMM yyyy')} — ${props.label}`}
        className="w-full border-collapse"
      >
        <thead>
          <tr>
            {(weeks[0] ?? []).map((day) => (
              <th
                key={day.toISOString()}
                scope="col"
                abbr={format(day, 'EEEE')}
                className="pb-1.5 text-micro font-semibold uppercase tracking-label text-ink-4"
              >
                {format(day, 'EEEEEE')}
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
                        'rounded-l-full bg-brand-subtle',
                      mode === 'range' &&
                        isEnd &&
                        start &&
                        !isStart &&
                        'rounded-r-full bg-brand-subtle',
                    )}
                  >
                    <button
                      type="button"
                      ref={(node) => registerDay(key, node)}
                      tabIndex={isSameDay(day, focusedDate) ? 0 : -1}
                      disabled={disabled}
                      aria-current={today ? 'date' : undefined}
                      aria-label={format(day, 'EEEE d MMMM yyyy')}
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
                      {format(day, 'd')}
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
    const moves: Record<string, number | undefined> = {
      ArrowLeft: -1,
      ArrowRight: 1,
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
          icon={<ChevronLeft />}
          label="Previous month"
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
              {format(current, 'MMMM yyyy')}
            </span>
          ))}
        </div>
        <IconButton
          icon={<ChevronRight />}
          label="Next month"
          size="sm"
          variant="ghost"
          disabled={!canGoForward}
          onClick={() => shiftMonth(1)}
        />
      </div>

      {/* The visible month is announced once, politely — a reader paging through
          months hears "March 2026" rather than forty-two day names. */}
      <span role="status" aria-live="polite" className="sr-only">
        Showing{' '}
        {months.map((current) => format(current, 'MMMM yyyy')).join(' and ')}
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
  ({ selected, onSelect, label = 'Choose a date', ...props }, ref) => (
    <div ref={ref}>
      <CalendarBase
        {...props}
        mode="single"
        label={label}
        range={selected ? { from: selected, to: selected } : null}
        onDayPick={(date) => onSelect?.(date)}
      />
    </div>
  ),
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
>(
  (
    {
      selected,
      onSelect,
      label = 'Choose a date range',
      numberOfMonths = 2,
      ...props
    },
    ref,
  ) => {
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
          label={label}
          numberOfMonths={numberOfMonths}
          range={range}
          onDayPick={pick}
        />
      </div>
    )
  },
)
RangeCalendar.displayName = 'RangeCalendar'
