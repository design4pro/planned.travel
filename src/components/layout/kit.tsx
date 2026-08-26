import { cva } from 'class-variance-authority'
import { cn } from '#/lib/cn'

import type { VariantProps } from 'class-variance-authority'
import type { ComponentPropsWithRef, ComponentPropsWithoutRef } from 'react'

/**
 * The application chrome's building blocks. Every value resolves to a token
 * from `src/styles/tokens.css`, so the shell repaints correctly in both themes
 * without a single hardcoded colour, radius or shadow.
 *
 * What is here is only what the chrome itself renders. Everything a *screen*
 * needs is a design-system primitive and lives in `src/components/ui`
 * (`docs/SPEC.md` §6), and this file used to carry a second, drifting copy of
 * seven of them — `GlassPanel`, `Divider`, `Fab`, `Badge`, `EmptyState`,
 * `StatTile`, `AvatarStack` — none of which any file imported. A rival copy of a
 * primitive is worse than no copy: the round that taught the shipped
 * `AvatarStack` to render its `+n` tail through the catalogue and its party
 * through `formatList` left this one still writing ASCII digits with an English
 * sign order, and a reader would have got whichever the next author happened to
 * import.
 *
 * Both of those primitives now have a consumer in the shell rather than merely
 * no rival: `user-menu.tsx` takes its `Avatar` from `#/components/ui`, and the
 * admin console's member panel heads itself with the shipped `AvatarStack`, so
 * the localised `+n` tail and the `formatList` party summary are on a screen. A
 * removed rival and an unconsumed original are the same defect wearing different
 * clothes.
 *
 * `Panel`, `SectionLabel` and the two skeletons below are the same shape as
 * `Card`, `SectionLabel` and `Skeleton` in `src/components/ui` and should end up
 * being them. They stay for now because four chrome files render them and the
 * substitution is a visual change (`Card variant="inverse"` steps the shadow up,
 * and the shipped `Skeleton` sweeps a `::before` rather than an inner span) that
 * belongs in an item which owns the baselines it would move.
 */

/** Colour/shadow only — layout properties are never animated. */
export const transitionBase =
  'transition-[background-color,border-color,color,box-shadow,opacity,transform] duration-base ease-out-quint'

/* ------------------------------------------------------------------ surfaces */

export function Panel({
  className,
  inverse = false,
  ...props
}: ComponentPropsWithoutRef<'div'> & { inverse?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border shadow-card',
        inverse
          ? 'border-inverse-edge bg-inverse text-inverse-on'
          : 'border-edge-faint bg-surface text-ink',
        className,
      )}
      {...props}
    />
  )
}

export function SectionLabel({ className, ...props }: ComponentPropsWithoutRef<'p'>) {
  return <p className={cn('text-micro uppercase text-ink-3', className)} {...props} />
}

/* ------------------------------------------------------------------- buttons */

export const buttonClass = cva(
  cn(
    'relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full border font-medium focus-ring',
    transitionBase,
    'active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
  ),
  {
    variants: {
      variant: {
        primary:
          'border-transparent bg-accent text-accent-on shadow-card hover:bg-accent-hover hover:shadow-elevated',
        secondary: 'border-edge-strong/60 bg-surface text-ink hover:bg-surface-2',
        ghost: 'border-transparent bg-transparent text-ink-2 hover:bg-hover hover:text-ink',
        subtle: 'border-transparent bg-surface-2 text-ink hover:bg-surface-inset',
        brand:
          'border-transparent bg-brand text-brand-on shadow-card hover:bg-brand-hover hover:shadow-elevated',
        danger: 'border-transparent bg-danger-soft text-danger hover:brightness-[0.97]',
        inverse: 'border-inverse-edge bg-inverse text-inverse-on hover:opacity-90',
      },
      size: {
        sm: 'h-8 gap-1.5 px-3 text-caption',
        md: 'h-10 px-4 text-label',
        lg: 'h-12 px-6 text-body',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

type ButtonVariants = VariantProps<typeof buttonClass>

export function ActionButton({
  className,
  variant,
  size,
  type = 'button',
  ...props
}: ComponentPropsWithRef<'button'> & ButtonVariants) {
  return <button type={type} className={cn(buttonClass({ variant, size }), className)} {...props} />
}

export function IconButton({
  className,
  children,
  type = 'button',
  ...props
}: ComponentPropsWithRef<'button'>) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-full text-ink-3 focus-ring',
        transitionBase,
        'hover:bg-hover hover:text-ink active:bg-active disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ skeleton */

/** A shimmer, not a blink — it reads as "loading", not as "broken". */
export function Skeleton({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      aria-hidden
      data-motion-safe="fade"
      className={cn('relative overflow-hidden rounded-md bg-surface-inset', className)}
      {...props}
    >
      <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-surface/70 to-transparent" />
    </div>
  )
}

/** Text-shaped skeleton rows; widths taper so the block reads like a paragraph. */
export function SkeletonLines({ lines = 3, className }: { lines?: number; className?: string }) {
  const widths = ['w-11/12', 'w-full', 'w-9/12', 'w-10/12', 'w-7/12']
  return (
    <div className={cn('space-y-2.5', className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cn('h-3', widths[index % widths.length])} />
      ))}
    </div>
  )
}
