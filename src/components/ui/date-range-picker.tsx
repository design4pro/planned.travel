import * as React from 'react'
import { CalendarRange, X } from 'lucide-react'
import { addDays } from 'date-fns/addDays'
import { differenceInCalendarDays } from 'date-fns/differenceInCalendarDays'
import { startOfDay } from 'date-fns/startOfDay'

import { cn } from '#/lib/cn'
import { formatDayMonth, formatNumber } from '#/lib/format'
import { RangeCalendar, isoDay } from './calendar'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { useFieldControl } from './field'
import { dateTriggerClasses } from './date-picker'
import { useUiI18n } from './copy'
import {
  fieldSizes,
  focusRing,
  iconSizes,
  transitionBase,
  useControllableState,
} from './shared'

import type { Translate } from '#/lib/i18n'
import type { CalendarBaseProps, DateRange } from './calendar'
import type { FieldSize } from './shared'

export type DateRangePreset = {
  label: string
  /** Built fresh on click, so "next 7 days" is always relative to today. */
  build: () => DateRange
}

/**
 * Trip-shaped defaults. Callers with their own seasons pass their own.
 *
 * A function of the translator rather than a constant: the labels are copy, and
 * copy frozen at module scope is copy in whatever language the module was
 * written in. The spans stay relative to today, so "next 7 days" is always the
 * next seven.
 */
export function defaultRangePresets(t: Translate): Array<DateRangePreset> {
  const span = (days: number) => () => ({
    from: startOfDay(new Date()),
    to: addDays(startOfDay(new Date()), days - 1),
  })
  return [
    { label: t('ui.dateRange.preset.week'), build: span(7) },
    { label: t('ui.dateRange.preset.fortnight'), build: span(14) },
    { label: t('ui.dateRange.preset.month'), build: span(30) },
  ]
}

export type DateRangePickerProps = Omit<
  CalendarBaseProps,
  'className' | 'footer'
> & {
  value?: DateRange | null
  defaultValue?: DateRange | null
  onChange?: (range: DateRange | null) => void
  /**
   * Overrides the placeholder. Left out, the primitive says "Pick dates" in the
   * reader's language.
   */
  placeholder?: string
  size?: FieldSize
  invalid?: boolean
  disabled?: boolean
  id?: string
  clearable?: boolean
  ariaLabel?: string
  triggerClassName?: string
  contentClassName?: string
  /** Quick ranges down the leading edge of the panel. Pass `[]` to hide them. */
  presets?: Array<DateRangePreset>
  /** Shows "8 nights" beside the dates once both ends are set. */
  showNights?: boolean
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
      placeholder,
      size = 'md',
      invalid,
      disabled,
      id,
      clearable = false,
      ariaLabel,
      triggerClassName,
      contentClassName,
      presets,
      showNights = true,
      ...calendarProps
    },
    ref,
  ) => {
    const ui = useUiI18n()
    const [open, setOpen] = React.useState(false)
    const [range, setRange] = useControllableState<DateRange | null>({
      value,
      defaultValue,
      onChange,
    })

    const field = useFieldControl({ id, 'aria-invalid': invalid, disabled })
    const quickRanges = presets ?? defaultRangePresets(ui.t)
    const start = range ? formatDayMonth(isoDay(range.from), ui.locale) : null
    const label =
      start === null
        ? null
        : range?.to
          ? ui.t('ui.dateRange.value', {
              start,
              end: formatDayMonth(isoDay(range.to), ui.locale) ?? '',
            })
          : ui.t('ui.dateRange.valuePending', { start })
    const nights = range?.to
      ? differenceInCalendarDays(range.to, range.from)
      : 0
    /*
     * `count` picks the plural branch; `nights` is what the reader sees.
     * `docs/SPEC.md` §8 splits the two because a raw substitution renders ASCII
     * digits with no group separator in all twenty-three locales — a
     * three-week Baltic winter reads `1,234` in German only if the number goes
     * through the frozen formatter first, and `1.234` is what German wants.
     */
    const nightParams = {
      count: nights,
      nights: formatNumber(nights, ui.locale),
    }

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
                clearable && range && 'pe-9',
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
                {label ?? placeholder ?? ui.t('ui.dateRange.placeholder')}
              </span>
              {showNights && nights > 0 ? (
                <span className="shrink-0 text-caption tabular-nums text-ink-3">
                  {ui.t('ui.dateRange.nights', nightParams)}
                </span>
              ) : null}
            </button>
          </PopoverTrigger>

          {clearable && range && !field.disabled ? (
            <button
              type="button"
              aria-label={ui.t('ui.dateRange.clear')}
              onClick={() => setRange(null)}
              className={cn(
                'absolute top-1/2 end-1.5 grid size-6 -translate-y-1/2 place-items-center rounded-full text-ink-4',
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
            {quickRanges.length > 0 ? (
              <div
                className="flex shrink-0 gap-1.5 sm:w-36 sm:flex-col sm:border-e sm:border-edge-faint sm:pe-3"
                role="group"
                aria-label={ui.t('ui.dateRange.presets')}
              >
                {quickRanges.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setRange(preset.build())}
                    className={cn(
                      'rounded-md px-2.5 py-1.5 text-start text-caption font-medium text-ink-2 whitespace-nowrap',
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
                  <p className="text-caption font-medium tabular-nums text-ink-2">
                    {ui.t('ui.dateRange.nightsSelected', nightParams)}
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
