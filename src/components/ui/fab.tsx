import * as React from 'react'
import { Slot } from 'radix-ui'
import { cva } from 'class-variance-authority'

import { cn } from '#/lib/cn'
import { Spinner } from './spinner'
import { disabledState, focusRing, transitionBase } from './shared'

import type { VariantProps } from 'class-variance-authority'

const fabVariants = cva(
  [
    'group inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold select-none',
    focusRing,
    transitionBase,
    disabledState,
    'shadow-elevated hover:-translate-y-0.5 hover:shadow-modal active:translate-y-0 active:shadow-elevated',
    'motion-reduce:hover:translate-y-0',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      tone: {
        accent: 'bg-accent text-accent-on hover:bg-accent-hover',
        brand: 'bg-brand text-brand-on hover:bg-brand-hover',
        surface: 'border border-edge bg-surface text-ink hover:bg-surface-2',
      },
      size: {
        md: 'h-12 w-12 text-label',
        lg: 'h-14 w-14 text-body',
      },
      /** Anchors it over the content, clear of the mobile tab bar and the notch. */
      position: {
        none: '',
        'bottom-right':
          'fixed right-4 bottom-[calc(var(--safe-bottom)+var(--space-5))] z-nav sm:right-6 sm:bottom-6',
        'bottom-center':
          'fixed left-1/2 bottom-[calc(var(--safe-bottom)+var(--space-5))] z-nav -translate-x-1/2',
      },
      extended: {
        true: 'w-auto px-5',
        false: '',
      },
    },
    defaultVariants: {
      tone: 'accent',
      size: 'md',
      position: 'bottom-right',
      extended: false,
    },
  },
)

const FabSlot = Slot.createSlot<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>('Fab')

export type FabProps = React.ComponentPropsWithoutRef<'button'> &
  VariantProps<typeof fabVariants> & {
    icon: React.ReactNode
    /**
     * Required. Used as the accessible name, and rendered as visible text when
     * `extended` is set.
     */
    label: string
    loading?: boolean
    asChild?: boolean
  }

/**
 * The floating primary action: near-black, bottom-right, above everything but
 * the navigation. It lifts 2px on hover — the only control in the system
 * allowed to move that far, because it is already floating.
 */
export const Fab = React.forwardRef<HTMLButtonElement, FabProps>(
  (
    {
      className,
      tone,
      size = 'md',
      position,
      extended,
      icon,
      label,
      loading = false,
      asChild = false,
      disabled = false,
      type,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading
    const classes = cn(
      fabVariants({ tone, size, position, extended }),
      className,
    )
    const glyph = (
      <span
        className="grid place-items-center [&_svg]:size-5"
        aria-hidden="true"
      >
        {loading ? (
          <Spinner size={size === 'lg' ? 'md' : 'sm'} label={null} />
        ) : (
          icon
        )}
      </span>
    )

    if (asChild) {
      return (
        <FabSlot
          ref={ref}
          className={cn(
            classes,
            isDisabled && 'pointer-events-none opacity-45 shadow-none',
          )}
          aria-label={extended ? undefined : label}
          aria-disabled={isDisabled || undefined}
          {...props}
        >
          <Slot.Slottable>{children}</Slot.Slottable>
          {glyph}
          {extended ? <span>{label}</span> : null}
        </FabSlot>
      )
    }

    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        className={classes}
        disabled={isDisabled}
        aria-label={extended ? undefined : label}
        aria-busy={loading || undefined}
        {...props}
      >
        {glyph}
        {extended ? <span>{label}</span> : null}
      </button>
    )
  },
)
Fab.displayName = 'Fab'
