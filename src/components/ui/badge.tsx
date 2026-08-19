import * as React from 'react'
import { Slot } from 'radix-ui'
import { cva } from 'class-variance-authority'

import { cn } from '#/lib/cn'

import type { VariantProps } from 'class-variance-authority'

export const badgeVariants = cva(
  [
    'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-semibold',
    'align-middle [&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      tone: {
        neutral: 'bg-surface-2 text-ink-2',
        accent: 'bg-accent text-accent-on',
        brand: 'bg-brand-subtle text-brand',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        danger: 'bg-danger-soft text-danger',
        info: 'bg-info-soft text-info',
        outline: 'border border-edge-strong text-ink-2',
        inverse:
          'bg-inverse-surface text-inverse-on ring-1 ring-inverse-edge ring-inset',
      },
      size: {
        sm: 'h-4.5 px-1.5 text-micro tracking-wide',
        md: 'h-5.5 px-2 text-caption',
        lg: 'h-7 px-2.5 text-label',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  },
)

const BadgeSlot = Slot.createSlot<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>('Badge')

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>

export type BadgeProps = React.ComponentPropsWithoutRef<'span'> &
  VariantProps<typeof badgeVariants> & {
    /** A 6px status dot before the label, inheriting the badge's text colour. */
    dot?: boolean
    icon?: React.ReactNode
    asChild?: boolean
  }

/**
 * A static status marker. It is never clickable — the moment a label needs a
 * click it becomes a `Chip`, which is a real button.
 */
export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className,
      tone,
      size,
      dot = false,
      icon,
      children,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? BadgeSlot : 'span'
    return (
      <Comp
        ref={ref}
        className={cn(badgeVariants({ tone, size }), className)}
        {...props}
      >
        {dot ? (
          <span
            className="size-1.5 shrink-0 rounded-full bg-current"
            aria-hidden="true"
          />
        ) : null}
        {icon ? (
          <span
            className="grid shrink-0 place-items-center [&_svg]:size-3"
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
        {children}
      </Comp>
    )
  },
)
Badge.displayName = 'Badge'

export type CountBadgeProps = Omit<BadgeProps, 'children'> & {
  count: number
  /** Anything above this shows as `max+`. */
  max?: number
}

/** Tabular numerals and a fixed minimum width, so 9 → 10 never nudges a tab. */
export const CountBadge = React.forwardRef<HTMLSpanElement, CountBadgeProps>(
  ({ count, max = 99, className, size = 'sm', ...props }, ref) => (
    <Badge
      ref={ref}
      size={size}
      className={cn('min-w-4.5 justify-center px-1 tabular-nums', className)}
      {...props}
    >
      {count > max ? `${max}+` : count}
    </Badge>
  ),
)
CountBadge.displayName = 'CountBadge'
