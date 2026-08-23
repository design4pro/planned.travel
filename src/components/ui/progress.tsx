import * as React from 'react'
import { Progress as ProgressPrimitive } from 'radix-ui'

import { cn } from '#/lib/cn'

const trackSizes = { xs: 'h-1', sm: 'h-1.5', md: 'h-2', lg: 'h-3' } as const

/** The smallest fill that still reads as a fill rather than as an empty track. */
const MIN_VISIBLE_PERCENT = 2

const tones = {
  brand: 'bg-brand',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
} as const

export type ProgressTone = keyof typeof tones

export type ProgressProps = Omit<
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>,
  'value'
> & {
  /** `null` renders the indeterminate sweep. */
  value?: number | null
  max?: number
  size?: keyof typeof trackSizes
  tone?: ProgressTone
  /** Label row above the bar. */
  label?: React.ReactNode
  /** Right-aligned value text. Defaults to a percentage when `label` is set. */
  valueText?: React.ReactNode
}

/**
 * A determinate bar, or an indeterminate sweep when `value` is `null`. The fill
 * moves with `translateX` on a full-width element rather than by animating
 * `width`, so a value ticking up never triggers a layout pass.
 */
export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      className,
      value = null,
      max = 100,
      size = 'md',
      tone = 'brand',
      label,
      valueText,
      ...props
    },
    ref,
  ) => {
    const indeterminate = value === null
    const clamped = indeterminate ? 0 : Math.min(Math.max(value, 0), max)
    const percent = max === 0 ? 0 : (clamped / max) * 100
    // A real value that rounds to nothing still has to show. 5.2 MB against a
    // 5 GB quota is 0.1% of the track — drawn faithfully it is an empty bar, and
    // an empty bar beside the words "5.2 MB used" reads as a broken component.
    // Exactly zero keeps an empty track, because that is the honest picture.
    const drawn = clamped > 0 ? Math.max(percent, MIN_VISIBLE_PERCENT) : 0

    return (
      <div className="w-full">
        {label || valueText ? (
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            {label ? (
              <span className="text-caption font-medium text-ink-2">
                {label}
              </span>
            ) : null}
            <span className="text-caption tabular-nums text-ink-3">
              {valueText ?? (indeterminate ? '' : `${Math.round(percent)}%`)}
            </span>
          </div>
        ) : null}

        <ProgressPrimitive.Root
          ref={ref}
          value={indeterminate ? null : clamped}
          max={max}
          className={cn(
            'relative w-full overflow-hidden rounded-full bg-surface-inset',
            // The fill is a transform along the x axis — the one thing in this
            // directory that no logical property can express — and the sweep
            // keyframes are the same. Mirroring the whole track under RTL turns
            // both round at once, and the track itself is a symmetrical pill, so
            // there is nothing else in here for the flip to damage.
            'rtl:-scale-x-100',
            trackSizes[size],
            className,
          )}
          {...props}
        >
          <ProgressPrimitive.Indicator
            data-motion-transform=""
            className={cn(
              'size-full rounded-full',
              tones[tone],
              // `origin-left` is read through the track's RTL mirror above, so
              // the sweep still starts from the edge the reader starts at.
              indeterminate
                ? 'animate-indeterminate origin-left'
                : 'transition-transform duration-slow ease-out-quint',
            )}
            style={
              indeterminate
                ? undefined
                : { transform: `translateX(-${100 - drawn}%)` }
            }
          />
        </ProgressPrimitive.Root>
      </div>
    )
  },
)
Progress.displayName = 'Progress'

export type ProgressRingProps = Omit<
  React.ComponentPropsWithoutRef<'div'>,
  'children'
> & {
  value: number
  max?: number
  /** Outer diameter in px steps of 4. */
  diameter?: number
  thickness?: number
  tone?: ProgressTone
  /** Centre content — usually the percentage or a remaining count. */
  children?: React.ReactNode
  /** Accessible name. Required, because the ring itself carries no text. */
  label: string
}

const ringTones = {
  brand: 'text-brand',
  accent: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
} as const

/**
 * The circular counterpart, for budget-used and packing-progress tiles. Drawn
 * with `stroke-dasharray` so the sweep animates without a single layout change.
 */
export const ProgressRing = React.forwardRef<HTMLDivElement, ProgressRingProps>(
  (
    {
      className,
      value,
      max = 100,
      diameter = 64,
      thickness = 6,
      tone = 'brand',
      label,
      children,
      ...props
    },
    ref,
  ) => {
    const clamped = Math.min(Math.max(value, 0), max)
    const percent = max === 0 ? 0 : clamped / max
    const radius = (diameter - thickness) / 2
    const circumference = 2 * Math.PI * radius

    return (
      <div
        ref={ref}
        className={cn(
          'relative inline-grid shrink-0 place-items-center',
          className,
        )}
        style={{ width: diameter, height: diameter }}
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        {...props}
      >
        <svg
          width={diameter}
          height={diameter}
          viewBox={`0 0 ${diameter} ${diameter}`}
          aria-hidden="true"
        >
          <circle
            cx={diameter / 2}
            cy={diameter / 2}
            r={radius}
            fill="none"
            strokeWidth={thickness}
            className="stroke-surface-inset"
          />
          <circle
            cx={diameter / 2}
            cy={diameter / 2}
            r={radius}
            fill="none"
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - percent)}
            transform={`rotate(-90 ${diameter / 2} ${diameter / 2})`}
            className={cn(
              'stroke-current transition-[stroke-dashoffset] duration-slow ease-out-quint',
              ringTones[tone],
            )}
          />
        </svg>
        {children ? (
          <span className="absolute inset-0 grid place-items-center text-caption font-semibold tabular-nums text-ink">
            {children}
          </span>
        ) : null}
      </div>
    )
  },
)
ProgressRing.displayName = 'ProgressRing'
