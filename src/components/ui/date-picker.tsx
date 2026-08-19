import * as React from 'react'
import { CalendarDays, X } from 'lucide-react'
import { format, isValid } from 'date-fns'

import { cn } from '#/lib/cn'
import { Calendar } from './calendar'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { useFieldControl } from './field'
import {
  fieldSizes,
  focusRing,
  iconSizes,
  transitionBase,
  useControllableState,
} from './shared'

import type { CalendarBaseProps } from './calendar'
import type { FieldSize } from './shared'

export const dateTriggerClasses = [
  'flex w-full items-center gap-2 rounded-md border border-edge-strong bg-surface text-left text-ink',
  transitionBase,
  focusRing,
  'hover:border-ink-4',
  'data-[state=open]:border-brand',
  'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-4 disabled:hover:border-edge-strong',
  'aria-[invalid=true]:border-danger',
]

export type DatePickerProps = Omit<
  CalendarBaseProps,
  'className' | 'footer'
> & {
  value?: Date | null
  defaultValue?: Date | null
  onChange?: (date: Date | null) => void
  /** `date-fns` pattern for the trigger's label. */
  displayFormat?: string
  placeholder?: string
  size?: FieldSize
  invalid?: boolean
  disabled?: boolean
  id?: string
  /** Adds a reset affordance once a date is chosen. */
  clearable?: boolean
  /** Accessible name when there is no visible label. */
  ariaLabel?: string
  triggerClassName?: string
  /** Class for the floating popover panel. */
  contentClassName?: string
  /** Content under the grid — a "Today" shortcut, a note about availability. */
  footer?: React.ReactNode
}

/**
 * A field that opens a month grid. The trigger carries the formatted date and
 * the invalid state; the calendar lives in a popover, so it never takes up room
 * in the form until it is asked for.
 */
export const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  (
    {
      value,
      defaultValue = null,
      onChange,
      displayFormat = 'd MMM yyyy',
      placeholder = 'Pick a date',
      size = 'md',
      invalid,
      disabled,
      id,
      clearable = false,
      ariaLabel,
      triggerClassName,
      contentClassName,
      footer,
      ...calendarProps
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false)
    const [selected, setSelected] = useControllableState<Date | null>({
      value,
      defaultValue,
      onChange,
    })

    const field = useFieldControl({ id, 'aria-invalid': invalid, disabled })
    const hasValue = selected !== null && isValid(selected)

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
                clearable && hasValue && 'pr-9',
                triggerClassName,
              )}
              {...field}
            >
              <CalendarDays
                size={iconSizes[size]}
                className="shrink-0 text-ink-4"
                aria-hidden="true"
              />
              <span
                className={cn(
                  'min-w-0 flex-1 truncate',
                  !hasValue && 'text-ink-4',
                )}
              >
                {selected && isValid(selected)
                  ? format(selected, displayFormat)
                  : placeholder}
              </span>
            </button>
          </PopoverTrigger>

          {clearable && hasValue && !field.disabled ? (
            <button
              type="button"
              aria-label="Clear date"
              onClick={() => setSelected(null)}
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
          <Calendar
            {...calendarProps}
            selected={selected}
            footer={footer}
            onSelect={(date) => {
              setSelected(date)
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
    )
  },
)
DatePicker.displayName = 'DatePicker'
