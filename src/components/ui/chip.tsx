import * as React from 'react'
import { X } from 'lucide-react'
import { cva } from 'class-variance-authority'

import { cn } from '#/lib/cn'
import { disabledState, focusRing, transitionBase } from './shared'

import type { VariantProps } from 'class-variance-authority'

const chipVariants = cva(
  [
    'group inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
    'border select-none',
    transitionBase,
    focusRing,
    disabledState,
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      tone: {
        neutral: '',
        brand: '',
        success: '',
        warning: '',
        danger: '',
      },
      selected: { true: '', false: '' },
      size: {
        sm: 'h-7 px-2.5 text-caption',
        md: 'h-8 px-3 text-label',
        lg: 'h-10 px-4 text-label',
      },
    },
    compoundVariants: [
      {
        selected: false,
        tone: 'neutral',
        class:
          'border-edge-strong bg-surface text-ink-2 hover:border-ink-4 hover:bg-surface-2 hover:text-ink',
      },
      {
        selected: false,
        tone: 'brand',
        class: 'border-brand/30 bg-surface text-brand hover:bg-brand-subtle',
      },
      {
        selected: false,
        tone: 'success',
        class:
          'border-success/30 bg-surface text-success hover:bg-success-soft',
      },
      {
        selected: false,
        tone: 'warning',
        class:
          'border-warning/30 bg-surface text-warning hover:bg-warning-soft',
      },
      {
        selected: false,
        tone: 'danger',
        class: 'border-danger/30 bg-surface text-danger hover:bg-danger-soft',
      },
      {
        selected: true,
        tone: 'neutral',
        class:
          'border-transparent bg-accent text-accent-on shadow-card hover:bg-accent-hover',
      },
      {
        selected: true,
        tone: 'brand',
        class:
          'border-transparent bg-brand text-brand-on shadow-card hover:bg-brand-hover',
      },
      {
        selected: true,
        tone: 'success',
        class: 'border-transparent bg-success text-success-on shadow-card',
      },
      {
        selected: true,
        tone: 'warning',
        class: 'border-transparent bg-warning text-warning-on shadow-card',
      },
      {
        selected: true,
        tone: 'danger',
        class: 'border-transparent bg-danger text-danger-on shadow-card',
      },
    ],
    defaultVariants: { tone: 'neutral', selected: false, size: 'md' },
  },
)

export type ChipProps = Omit<
  React.ComponentPropsWithoutRef<'button'>,
  'children'
> &
  VariantProps<typeof chipVariants> & {
    children: React.ReactNode
    icon?: React.ReactNode
    /** Trailing count, e.g. the `10` on an "All" filter. */
    count?: number
    /** Adds the remove affordance. Its own button, so it has its own name. */
    onRemove?: () => void
    removeLabel?: string
  }

/**
 * The filter and tag control. Always a real `<button>` with `aria-pressed`, so
 * a screen reader hears "All, toggle button, pressed" rather than nothing.
 */
export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  (
    {
      className,
      tone,
      selected = false,
      size,
      icon,
      count,
      onRemove,
      removeLabel = 'Remove',
      children,
      type,
      ...props
    },
    ref,
  ) => (
    <span className="relative inline-flex">
      <button
        ref={ref}
        type={type ?? 'button'}
        aria-pressed={selected ?? false}
        data-selected={selected ? '' : undefined}
        className={cn(
          chipVariants({ tone, selected, size }),
          onRemove && 'pr-7',
          className,
        )}
        {...props}
      >
        {icon ? (
          <span
            className="grid place-items-center [&_svg]:size-3.5"
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
        {children}
        {typeof count === 'number' ? (
          <span
            className={cn(
              'ml-0.5 rounded-full px-1.5 text-caption font-semibold tabular-nums',
              selected ? 'bg-accent-on/15' : 'bg-surface-inset',
            )}
          >
            {count}
          </span>
        ) : null}
      </button>

      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className={cn(
            'absolute top-1/2 right-1 grid size-5 -translate-y-1/2 place-items-center rounded-full',
            transitionBase,
            focusRing,
            selected
              ? 'text-accent-on/70 hover:bg-accent-on/15'
              : 'text-ink-4 hover:bg-hover hover:text-ink',
          )}
        >
          <X size={12} strokeWidth={2.5} aria-hidden="true" />
        </button>
      ) : null}
    </span>
  ),
)
Chip.displayName = 'Chip'
