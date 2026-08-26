import * as React from 'react'
import { Slider as SliderPrimitive } from 'radix-ui'

import { cn } from '#/lib/cn'
import { formatNumber } from '#/lib/format'
import { useField } from './field'
import { useUiI18n } from './copy'
import { focusRing, transitionBase } from './shared'

const trackHeights = { sm: 'h-1', md: 'h-1.5', lg: 'h-2' } as const
const thumbSizes = { sm: 'size-3.5', md: 'size-4.5', lg: 'size-5' } as const

export type SliderProps = Omit<
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>,
  'children'
> & {
  size?: keyof typeof trackHeights
  /**
   * Renders a value bubble above each thumb. Left alone, the bubble carries the
   * bare number grouped for the negotiated locale; pass a formatter to say what
   * the number *is* — currency, distance, "3 nights".
   */
  showValue?: boolean
  formatValue?: (value: number) => string
  /** Tick marks under the track. Numbers are positions on the value scale. */
  ticks?: Array<number>
  /** Labels for the two ends of the scale. */
  minLabel?: React.ReactNode
  maxLabel?: React.ReactNode
  /** Accessible names for the thumbs, in order. */
  thumbLabels?: Array<string>
}

/**
 * One thumb or many — pass `value`/`defaultValue` with more than one entry and
 * it becomes a range. Arrow keys step, Shift+Arrow steps large, Home/End jump,
 * and the whole track is a click target.
 */
export const Slider = React.forwardRef<HTMLSpanElement, SliderProps>(
  (
    {
      className,
      size = 'md',
      showValue = false,
      formatValue,
      ticks,
      minLabel,
      maxLabel,
      thumbLabels,
      min = 0,
      max = 100,
      value,
      defaultValue,
      ...props
    },
    ref,
  ) => {
    const { locale } = useUiI18n()
    const field = useField()
    const values = value ?? defaultValue ?? [min]
    const span = max - min || 1
    // `String(n)` was ASCII digits and an ASCII decimal point in every locale.
    // The grouped form is the same one the rest of the product uses, so a bubble
    // reading 1 200 in French sits beside a caption that says the same.
    const label = formatValue ?? ((next: number) => formatNumber(next, locale))

    return (
      <div className={cn('w-full', showValue && 'pt-7')}>
        <SliderPrimitive.Root
          ref={ref}
          min={min}
          max={max}
          value={value}
          defaultValue={defaultValue}
          aria-describedby={props['aria-describedby'] ?? field?.hintId}
          className={cn(
            'relative flex w-full touch-none items-center select-none',
            'data-[orientation=vertical]:h-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
            'data-[disabled]:pointer-events-none data-[disabled]:opacity-45',
            className,
          )}
          {...props}
        >
          <SliderPrimitive.Track
            className={cn(
              'relative w-full grow overflow-hidden rounded-full bg-surface-inset',
              'data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5',
              trackHeights[size],
            )}
          >
            <SliderPrimitive.Range className="absolute h-full rounded-full bg-brand data-[orientation=vertical]:w-full" />
          </SliderPrimitive.Track>

          {values.map((thumbValue, index) => (
            <SliderPrimitive.Thumb
              key={index}
              aria-label={thumbLabels?.[index]}
              className={cn(
                'group relative block shrink-0 rounded-full border-2 border-brand bg-surface shadow-card',
                transitionBase,
                focusRing,
                'hover:scale-110 active:scale-105',
                'motion-reduce:hover:scale-100 motion-reduce:active:scale-100',
                thumbSizes[size],
              )}
            >
              {showValue ? (
                <span
                  className={cn(
                    // Centred over the thumb: symmetrical, so it needs no
                    // direction of its own.
                    'pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded-sm bg-inverse px-1.5 py-0.5',
                    'text-caption font-semibold tabular-nums text-inverse-on shadow-elevated',
                  )}
                  data-numeric=""
                >
                  {label(thumbValue)}
                </span>
              ) : null}
            </SliderPrimitive.Thumb>
          ))}
        </SliderPrimitive.Root>

        {ticks && ticks.length > 0 ? (
          <div className="relative mt-1.5 h-1" aria-hidden="true">
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute top-0 h-1 w-px -translate-x-1/2 rounded-full bg-edge-strong/70"
                // The scale runs from the inline start, so the ticks are placed
                // from it too: Radix reverses the track under `dir="rtl"` and a
                // physical `left` would have left them behind.
                style={{ insetInlineStart: `${((tick - min) / span) * 100}%` }}
              />
            ))}
          </div>
        ) : null}

        {minLabel || maxLabel ? (
          <div className="mt-1.5 flex items-center justify-between text-caption tabular-nums text-ink-4">
            <span>{minLabel}</span>
            <span>{maxLabel}</span>
          </div>
        ) : null}
      </div>
    )
  },
)
Slider.displayName = 'Slider'
