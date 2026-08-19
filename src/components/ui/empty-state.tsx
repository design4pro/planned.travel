import * as React from 'react'
import { cva } from 'class-variance-authority'

import { cn } from '#/lib/cn'

import type { VariantProps } from 'class-variance-authority'

const emptyStateVariants = cva(
  'flex flex-col items-center justify-center text-center',
  {
    variants: {
      variant: {
        /** Sits inside a card that already has its own edge. */
        plain: '',
        /** The dashed invitation, for a list that has never had content. */
        dashed: 'rounded-xl border border-dashed border-edge-strong/60',
        /** A filled panel, for a search that returned nothing. */
        filled: 'rounded-xl border border-edge-faint bg-surface-2',
      },
      size: {
        sm: 'gap-2 px-5 py-8',
        md: 'gap-3 px-6 py-12',
        lg: 'gap-4 px-8 py-16',
      },
    },
    defaultVariants: { variant: 'plain', size: 'md' },
  },
)

const iconWrapSizes = {
  sm: 'size-10 [&_svg]:size-4.5',
  md: 'size-12 [&_svg]:size-5',
  lg: 'size-16 [&_svg]:size-7',
} as const

const titleSizes = {
  sm: 'text-label',
  md: 'text-subtitle',
  lg: 'text-title font-display',
} as const

export type EmptyStateProps = Omit<
  React.ComponentPropsWithoutRef<'div'>,
  'title'
> &
  VariantProps<typeof emptyStateVariants> & {
    /** Glyph in a tinted round well. */
    icon?: React.ReactNode
    title: React.ReactNode
    description?: React.ReactNode
    /** The primary invitation — usually one `Button`. */
    action?: React.ReactNode
    /** A quieter alternative beside it. */
    secondaryAction?: React.ReactNode
    /**
     * Tints the icon well. `brand` is the inviting nothing — no trips yet, no
     * places yet. `warning` is the *degraded* nothing: the list is empty because
     * something upstream did not answer, not because the reader has nothing.
     */
    tone?: 'neutral' | 'brand' | 'warning'
  }

/**
 * The designed nothing. Every list in the product gets one of these rather than
 * a blank region, and it always names the next action — an empty state that
 * only apologises is a dead end.
 */
export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      className,
      variant,
      size = 'md',
      icon,
      title,
      description,
      action,
      secondaryAction,
      tone = 'neutral',
      ...props
    },
    ref,
  ) => (
    <div
      ref={ref}
      className={cn(emptyStateVariants({ variant, size }), className)}
      {...props}
    >
      {icon ? (
        <span
          className={cn(
            'mb-1 grid shrink-0 place-items-center rounded-full',
            tone === 'brand' && 'bg-brand-subtle text-brand',
            tone === 'warning' && 'bg-warning-soft text-warning',
            tone === 'neutral' && 'bg-surface-inset text-ink-3',
            iconWrapSizes[size ?? 'md'],
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
      ) : null}

      <p className={cn('font-semibold text-ink', titleSizes[size ?? 'md'])}>
        {title}
      </p>

      {description ? (
        <p className="max-w-prose text-label text-ink-3">{description}</p>
      ) : null}

      {action || secondaryAction ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2.5">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  ),
)
EmptyState.displayName = 'EmptyState'
