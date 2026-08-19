import * as React from 'react'
import { CalendarRange, X } from 'lucide-react'
import { addDays, differenceInCalendarDays, format, startOfDay } from 'date-fns'

import { cn } from '#/lib/cn'
import { RangeCalendar } from './calendar'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { useFieldControl } from './field'
import { dateTriggerClasses } from './date-picker'
import {
  fieldSizes,
  focusRing,
  iconSizes,
  transitionBase,
  useControllableState,
} from './shared'

import type { CalendarBaseProps, DateRange } from './calendar'
import type { FieldSize } from './shared'

export type DateRangePreset = {
  label: string
  /** Built fresh on click, so "next 7 days" is always relative to today. */
  build: () => DateRange
}

/** Trip-shaped defaults. Callers with their own seasons override them. */
export const defaultRangePresets: Array<DateRangePreset> = [
  {
    label: 'Next 7 days',
    build: () => ({
      from: startOfDay(new Date()),
      to: addDays(startOfDay(new Date()), 6),
    }),
  },
  {
    label: 'Next 2 weeks',
    build: () => ({
      from: startOfDay(new Date()),
      to: addDays(startOfDay(new Date()), 13),
    }),
  },
  {
    label: 'Next 30 days',
    build: () => ({
      from: startOfDay(new Date()),
      to: addDays(startOfDay(new Date()), 29),
    }),
  },
]

export type DateRangePickerProps = Omit<
  CalendarBaseProps,
  'className' | 'footer'
> & {
  value?: DateRange | null
  defaultValue?: DateRange | null
  onChange?: (range: DateRange | null) => void
  displayFormat?: string
  placeholder?: string
  size?: FieldSize
  invalid?: boolean
  disabled?: boolean
  id?: string
  clearable?: boolean
  ariaLabel?: string
  triggerClassName?: string
  contentClassName?: string
  /** Quick ranges down the left edge of the panel. Pass `[]` to hide them. */
  presets?: Array<DateRangePreset>
  /** Shows "8 nights" beside the dates once both ends are set. */
  showNights?: boolean
}

function formatRange(range: DateRange | null, pattern: string): string | null {
  if (!range) return null
  if (!range.to) return `${format(range.from, pattern)} — …`
  return `${format(range.from, pattern)} – ${format(range.to, pattern)}`
}

/**
 * Two-ended date selection: two months side by side on desktop, stacked on a
 * phone, with a live range preview as the pointer moves and the night count
 * spelled out — the number people actually care about when booking.
 */
export const DateRangePicker = React.forwardRef<
  HTMLButtonElement,
  DateRangePickerProps
>(
  (
    {
      value,
      defaultValue = null,
      onChange,
      displayFormat = 'd MMM',
      placeholder = 'Pick dates',
      size = 'md',
      invalid,
      disabled,
      id,
      clearable = false,
      ariaLabel,
      triggerClassName,
      contentClassName,
      presets = defaultRangePresets,
      showNights = true,
      ...calendarProps
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false)
    const [range, setRange] = useControllableState<DateRange | null>({
      value,
      defaultValue,
      onChange,
    })

    const field = useFieldControl({ id, 'aria-invalid': invalid, disabled })
    const label = formatRange(range, displayFormat)
    const nights = range?.to
      ? differenceInCalendarDays(range.to, range.from)
      : 0

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <span className="relative flex w-full items-center">
          <PopoverTrigger asChild>
            <button
              ref={ref}
              type="button"
              aria-label={ariaLabel}
              className={cn(
                dateTriggerClasses,
                fieldSizes[size],
                clearable && range && 'pr-9',
                triggerClassName,
              )}
              {...field}
            >
              <CalendarRange
                size={iconSizes[size]}
                className="shrink-0 text-ink-4"
                aria-hidden="true"
              />
              <span
                className={cn(
                  'min-w-0 flex-1 truncate',
                  !label && 'text-ink-4',
                )}
              >
                {label ?? placeholder}
              </span>
              {showNights && nights > 0 ? (
                <span className="shrink-0 text-caption tabular-nums text-ink-3">
                  {nights} {nights === 1 ? 'night' : 'nights'}
                </span>
              ) : null}
            </button>
          </PopoverTrigger>

          {clearable && range && !field.disabled ? (
            <button
              type="button"
              aria-label="Clear dates"
              onClick={() => setRange(null)}
              className={cn(
                'absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded-full text-ink-4',
                transitionBase,
                focusRing,
                'hover:bg-hover hover:text-ink',
              )}
            >
              <X size={iconSizes[size]} aria-hidden="true" />
            </button>
          ) : null}
        </span>

        <PopoverContent
          padding="sm"
          align="start"
          className={cn('w-auto', contentClassName)}
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            {presets.length > 0 ? (
              <div
                className="flex shrink-0 gap-1.5 sm:w-36 sm:flex-col sm:border-r sm:border-edge-faint sm:pr-3"
                role="group"
                aria-label="Quick ranges"
              >
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setRange(preset.build())}
                    className={cn(
                      'rounded-md px-2.5 py-1.5 text-left text-caption font-medium text-ink-2 whitespace-nowrap',
                      transitionBase,
                      focusRing,
                      'hover:bg-hover hover:text-ink active:bg-active',
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            ) : null}

            <RangeCalendar
              {...calendarProps}
              selected={range}
              onSelect={(next) => {
                setRange(next)
                if (next?.to) setOpen(false)
              }}
              footer={
                showNights && nights > 0 ? (
                  <p className="text-caption text-ink-3">
                    <span className="font-semibold tabular-nums text-ink">
                      {nights}
                    </span>{' '}
                    {nights === 1 ? 'night' : 'nights'} selected
                  </p>
                ) : null
              }
            />
          </div>
        </PopoverContent>
      </Popover>
    )
  },
)
DateRangePicker.displayName = 'DateRangePicker'
