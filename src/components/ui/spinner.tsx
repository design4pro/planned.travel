import * as React from 'react'

import { cn } from '#/lib/cn'
import { useUiCopy } from './copy'

const sizeMap = {
  xs: 12,
  sm: 14,
  md: 18,
  lg: 24,
  xl: 32,
} as const

export type SpinnerSize = keyof typeof sizeMap

export type SpinnerProps = Omit<
  React.ComponentPropsWithoutRef<'span'>,
  'children'
> & {
  size?: SpinnerSize
  /**
   * Announced to assistive tech. Left out, it says "Loading" in the reader's
   * language. Pass `null` when the spinner sits inside a control that already
   * describes the pending state (a loading Button, say), so screen readers do
   * not hear it twice.
   */
  label?: string | null
}

/**
 * An arc that sweeps rather than a ring that merely rotates — the stroke
 * length breathes, which reads as progress instead of as a stuck wheel.
 * Under `prefers-reduced-motion` the global rule swaps both animations for an
 * opacity pulse, so the indicator still signals without moving.
 */
export const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(
  ({ className, size = 'md', label, ...props }, ref) => {
    const t = useUiCopy()
    const announced = label === null ? null : (label ?? t('ui.status.loading'))
    const px = sizeMap[size]
    return (
      <span
        ref={ref}
        className={cn(
          'relative inline-flex shrink-0 items-center justify-center',
          className,
        )}
        style={{ width: px, height: px }}
        role={announced ? 'status' : undefined}
        aria-hidden={announced ? undefined : true}
        {...props}
      >
        <svg
          viewBox="0 0 44 44"
          fill="none"
          className="size-full animate-spin"
          data-motion-loop=""
        >
          <circle
            cx="22"
            cy="22"
            r="19"
            stroke="currentColor"
            strokeWidth="4"
            className="opacity-20"
          />
          <circle
            cx="22"
            cy="22"
            r="19"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            className="animate-sweep"
          />
        </svg>
        {announced ? <span className="sr-only">{announced}</span> : null}
      </span>
    )
  },
)
Spinner.displayName = 'Spinner'
