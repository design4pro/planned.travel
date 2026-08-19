import { cva } from 'class-variance-authority'
import { Avatar as RadixAvatar } from 'radix-ui'
import { cn } from '#/lib/cn'

import type { VariantProps } from 'class-variance-authority'
import type { ComponentPropsWithRef, ComponentPropsWithoutRef, ReactNode } from 'react'

/**
 * The application chrome's building blocks. Every value resolves to a token
 * from `src/styles/tokens.css`, so the shell repaints correctly in both themes
 * without a single hardcoded colour, radius or shadow.
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

/** Translucent floating panel used above the map. */
export function GlassPanel({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-glass-edge bg-glass shadow-glass backdrop-glass',
        className,
      )}
      {...props}
    />
  )
}

export function SectionLabel({ className, ...props }: ComponentPropsWithoutRef<'p'>) {
  return <p className={cn('text-micro uppercase text-ink-3', className)} {...props} />
}

export function Divider({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div role="separator" className={cn('h-px w-full bg-edge', className)} {...props} />
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

export type ButtonVariants = VariantProps<typeof buttonClass>

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

/** Floating near-black action button, bottom-right, above the content. */
export function Fab({
  className,
  children,
  type = 'button',
  ...props
}: ComponentPropsWithRef<'button'>) {
  return (
    <button
      type={type}
      className={cn(
        'fixed bottom-[calc(var(--safe-bottom)+5.5rem)] right-5 z-dropdown inline-flex h-13 items-center gap-2 rounded-full bg-accent px-5 text-label font-semibold text-accent-on shadow-elevated focus-ring',
        transitionBase,
        'hover:bg-accent-hover hover:shadow-modal active:translate-y-px',
        'md:bottom-8 md:right-8',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

/* -------------------------------------------------------------------- badges */

const badgeClass = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-micro uppercase',
  {
    variants: {
      tone: {
        neutral: 'border-edge bg-surface-2 text-ink-2',
        brand: 'border-transparent bg-brand-subtle text-brand',
        success: 'border-transparent bg-success-soft text-success',
        warning: 'border-transparent bg-warning-soft text-warning',
        danger: 'border-transparent bg-danger-soft text-danger',
        info: 'border-transparent bg-info-soft text-info',
        inverse: 'border-inverse-edge bg-inverse text-inverse-on',
        outline: 'border-edge-strong/50 bg-transparent text-ink-3',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export function Badge({
  className,
  tone,
  ...props
}: ComponentPropsWithoutRef<'span'> & VariantProps<typeof badgeClass>) {
  return <span className={cn(badgeClass({ tone }), className)} {...props} />
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

/* ---------------------------------------------------------------- emptiness */

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  /** Dashed outline reads as "there is room for one more here". */
  variant?: 'plain' | 'dashed'
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'plain',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl px-6 py-14 text-center',
        variant === 'dashed' && 'border border-dashed border-edge bg-surface/40',
        className,
      )}
    >
      {icon ? (
        <span className="mb-1 flex size-12 items-center justify-center rounded-full bg-surface-2 text-ink-3">
          {icon}
        </span>
      ) : null}
      <h3 className="font-display text-subtitle text-ink">{title}</h3>
      {description ? (
        <p className="max-w-xs text-label leading-relaxed text-ink-3">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

/* ----------------------------------------------------------------- statistic */

export interface StatTileProps {
  label: string
  value: string
  unit?: string
  hint?: string
  inverse?: boolean
  className?: string
  children?: ReactNode
}

/**
 * Tiny tracked label above an oversized display numeral — the signature of the
 * whole product. `numeral` keeps the baseline from jittering when values change.
 */
export function StatTile({
  label,
  value,
  unit,
  hint,
  inverse = false,
  className,
  children,
}: StatTileProps) {
  return (
    <Panel inverse={inverse} className={cn('flex flex-col gap-3 p-5', className)}>
      <SectionLabel className={inverse ? 'text-inverse-muted' : undefined}>{label}</SectionLabel>
      <p className="flex items-baseline gap-1.5">
        <span className="numeral font-display text-[2.5rem] font-bold leading-[0.95] tracking-tighter">
          {value}
        </span>
        {unit ? (
          <span
            className={cn(
              'text-subtitle font-medium',
              inverse ? 'text-inverse-muted' : 'text-ink-3',
            )}
          >
            {unit}
          </span>
        ) : null}
      </p>
      {hint ? (
        <p className={cn('text-caption', inverse ? 'text-inverse-muted' : 'text-ink-3')}>{hint}</p>
      ) : null}
      {children}
    </Panel>
  )
}

/* -------------------------------------------------------------------- avatar */

const AVATAR_SIZES = {
  sm: 'size-7 text-[0.625rem]',
  md: 'size-8 text-caption',
  lg: 'size-10 text-label',
  xl: 'size-14 text-subtitle',
} as const

export interface AvatarProps {
  name: string
  src?: string | null
  size?: keyof typeof AVATAR_SIZES
  className?: string
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? '') : ''
  return (first.slice(0, 1) + last.slice(0, 1)).toUpperCase()
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  return (
    <RadixAvatar.Root
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-inverse font-semibold text-inverse-on',
        AVATAR_SIZES[size],
        className,
      )}
    >
      {src ? <RadixAvatar.Image src={src} alt="" className="size-full object-cover" /> : null}
      <RadixAvatar.Fallback className="leading-none" delayMs={src ? 200 : 0}>
        {initialsOf(name)}
      </RadixAvatar.Fallback>
    </RadixAvatar.Root>
  )
}

/** Overlapping avatars, capped, with a "+n" tail. */
export function AvatarStack({
  people,
  max = 4,
  className,
}: {
  people: ReadonlyArray<{ name: string; src?: string | null }>
  max?: number
  className?: string
}) {
  const shown = people.slice(0, max)
  const overflow = people.length - shown.length
  return (
    <div className={cn('flex items-center', className)}>
      {shown.map((person, index) => (
        <Avatar
          key={`${person.name}-${index}`}
          name={person.name}
          src={person.src}
          size="sm"
          className="-ml-1.5 ring-2 ring-surface first:ml-0"
        />
      ))}
      {overflow > 0 ? (
        <span className="numeral -ml-1.5 inline-flex size-7 items-center justify-center rounded-full bg-surface-2 text-[0.625rem] font-semibold text-ink-3 ring-2 ring-surface">
          +{overflow}
        </span>
      ) : null}
    </div>
  )
}
