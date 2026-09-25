import * as React from 'react'
import * as Slot from 'radix-ui/slot'
import { cva } from 'class-variance-authority'

import { cn } from '#/lib/cn'
import { focusRing, transitionSlow } from './shared'

import type { VariantProps } from 'class-variance-authority'

export const cardVariants = cva(['relative isolate', transitionSlow], {
  variants: {
    variant: {
      /** The default: soft-cornered white on the warm canvas, hairline edge. */
      default:
        'rounded-xl border border-edge-faint bg-surface text-ink shadow-card',
      /** Recessed. For panels nested inside another card. */
      inset: 'rounded-lg border border-edge-faint bg-surface-2 text-ink',
      /** Near-black (near-white in dark). One per screen, at most. */
      inverse:
        'rounded-xl border border-inverse-edge bg-inverse text-inverse-on shadow-elevated',
      /** Brand-tinted. For upsells and empty-state invitations. */
      brand: 'rounded-xl border border-brand/15 bg-brand-subtle text-ink',
      /** Translucent, for floating over a map or photograph. */
      glass:
        'rounded-xl bg-glass text-ink ring-1 ring-glass-edge ring-inset shadow-glass backdrop-glass',
      /** No shadow, no fill — a bordered region. */
      outline: 'rounded-xl border border-edge bg-transparent text-ink',
      /** A dashed invitation to create something. */
      dashed:
        'rounded-xl border border-dashed border-edge-strong/60 bg-transparent text-ink',
    },
    padding: {
      none: '',
      sm: 'p-4',
      md: 'p-5',
      lg: 'p-6',
    },
  },
  defaultVariants: { variant: 'default', padding: 'md' },
})

const CardSlot = Slot.createSlot<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>('Card')

export type CardProps = React.ComponentPropsWithoutRef<'div'> &
  VariantProps<typeof cardVariants> & {
    /**
     * Adds the hover lift: 1px of translate plus one shadow step. Restrained
     * on purpose — a card that bounces reads as a toy.
     */
    interactive?: boolean
    asChild?: boolean
  }

const interactiveClasses = [
  'cursor-pointer',
  focusRing,
  'hover:-translate-y-px hover:shadow-elevated',
  'active:translate-y-0 active:shadow-card',
].join(' ')

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant,
      padding,
      interactive = false,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? CardSlot : 'div'
    return (
      <Comp
        ref={ref}
        data-interactive={interactive ? '' : undefined}
        className={cn(
          cardVariants({ variant, padding }),
          interactive && interactiveClasses,
          interactive && 'motion-reduce:hover:translate-y-0',
          className,
        )}
        {...props}
      />
    )
  },
)
Card.displayName = 'Card'

/** Title row plus optional trailing actions. Sits above `CardContent`. */
export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('mb-4 flex items-start justify-between gap-4', className)}
    {...props}
  />
))
CardHeader.displayName = 'CardHeader'

export type CardTitleProps = React.ComponentPropsWithoutRef<'h3'> & {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'div'
}

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, as: Tag = 'h3', ...props }, ref) => (
    <Tag
      ref={ref}
      className={cn('text-subtitle font-semibold text-ink', className)}
      {...props}
    />
  ),
)
CardTitle.displayName = 'CardTitle'

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<'p'>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('mt-1 text-caption text-ink-3', className)}
    {...props}
  />
))
CardDescription.displayName = 'CardDescription'

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-ink-2', className)} {...props} />
))
CardContent.displayName = 'CardContent'

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'mt-5 flex items-center gap-3 border-t border-edge-faint pt-4',
      className,
    )}
    {...props}
  />
))
CardFooter.displayName = 'CardFooter'

/**
 * A padded band inside a `padding="none"` card — the building block for lists
 * that need full-bleed dividers between rows.
 */
export const CardSection = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'px-5 py-4 not-last:border-b not-last:border-edge-faint',
      className,
    )}
    {...props}
  />
))
CardSection.displayName = 'CardSection'
