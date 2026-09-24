import * as React from 'react'
import * as ProgressPrimitive from 'radix-ui/progress'

import { cn } from '#/lib/cn'
import { formatPercent } from '#/lib/format'
import { useUiI18n } from './copy'

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
  /**
   * The value text at the inline end of the label row. Left out, the primitive
   * writes the percentage itself, punctuated and placed the way the negotiated
   * locale does it — `42%` in English, `%42` in Turkish, `٤٢٪` in Arabic.
   */
  valueText?: React.ReactNode
}

/**
 * A determinate bar, or an indeterminate sweep when `value` is `null`. The fill
 * is a full-width element pushed off the track by the `translate` property
 * rather than sized with `width`, so a value ticking up never triggers a layout
 * pass.
 *
 * Why `translate` and not `transform`. The two paint identically, but they are
 * different CSS properties, and `src/styles/styles.css` resets exactly one of
 * them: `[data-motion-transform] { transform: none !important }` inside the
 * reduced-motion block, so that nothing translates, scales or rotates for a
 * reader who asked us not to. A fill *positioned* with `transform` is caught by
 * that reset — measured: every determinate bar painted a full track for anyone
 * with reduce-motion on, which is a 40%-spent budget reading as spent. The
 * offset is not motion, it is the value, and it has to survive.
 *
 * `translate` does survive it, and it is the same property Tailwind compiles
 * `translate-x-*` to — which is why the switch thumb and the segmented tab pill
 * already land correctly under the same reset. The transition still collapses,
 * because the reduced-motion block also caps every `transition-duration`, so the
 * fill arrives at the right place with no animation rather than at the wrong
 * place with none.
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
    const { locale } = useUiI18n()
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
            <span
              className="text-caption tabular-nums text-ink-3"
              data-numeric=""
            >
              {valueText ??
                (indeterminate ? '' : formatPercent(percent / 100, locale))}
            </span>
          </div>
        ) : null}

        <ProgressPrimitive.Root
          ref={ref}
          value={indeterminate ? null : clamped}
          max={max}
          className={cn(
            'relative w-full overflow-hidden rounded-full bg-surface-inset',
            // The fill moves along the x axis — the one thing in this directory
            // that no logical property can express — and the sweep keyframes do
            // too. Mirroring the whole track under RTL turns both round at once,
            // and the track itself is a symmetrical pill, so there is nothing
            // else in here for the flip to damage.
            'rtl:-scale-x-100',
            trackSizes[size],
            className,
          )}
          {...props}
        >
          <ProgressPrimitive.Indicator
            /*
             * Both attributes belong to the sweep and neither to the value. The
             * sweep is a `transform` keyframe, so the reduced-motion reset must
             * reach it; a frozen sweep would then sit at whichever position the
             * base style gives it — a solid full track, indistinguishable from
             * "finished" — so `data-motion-loop` swaps the movement for the
             * gentle opacity pulse that block defines. A determinate fill has
             * nothing to freeze: its offset is data, carried on `translate`.
             */
            data-motion-transform={indeterminate ? '' : undefined}
            data-motion-loop={indeterminate ? '' : undefined}
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
              indeterminate ? undefined : { translate: `-${100 - drawn}% 0` }
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
