import * as React from 'react'
import * as Slot from 'radix-ui/slot'
import { cva } from 'class-variance-authority'

import { cn } from '#/lib/cn'
import { Spinner } from './spinner'
import { disabledState, focusRing, transitionBase } from './shared'

import type { VariantProps } from 'class-variance-authority'

const iconButtonVariants = cva(
  [
    'relative inline-grid shrink-0 place-items-center select-none',
    focusRing,
    transitionBase,
    disabledState,
    'active:translate-y-px',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-accent-on shadow-card hover:bg-accent-hover hover:shadow-elevated active:shadow-card',
        secondary:
          'border border-edge-strong bg-surface text-ink shadow-card hover:border-ink-4 hover:bg-surface-2 active:bg-surface-inset active:shadow-none',
        ghost: 'text-ink-3 hover:bg-hover hover:text-ink active:bg-active',
        subtle: 'bg-surface-2 text-ink-2 hover:bg-surface-inset hover:text-ink',
        danger: 'text-danger hover:bg-danger-soft active:bg-danger-soft/70',
        brand:
          'bg-brand text-brand-on shadow-card hover:bg-brand-hover hover:shadow-elevated',
        inverse:
          'bg-inverse-surface text-inverse-on ring-1 ring-inverse-edge ring-inset hover:bg-inverse-on/15',
        /** Floats over a map or photograph — needs its own ground. */
        glass:
          'bg-glass text-ink shadow-glass ring-1 ring-glass-edge ring-inset backdrop-glass hover:text-ink',
      },
      /**
       * The boxes match `Button`'s ladder. The glyph inside is not set here:
       * `glyphForSize` below owns it, and it sizes the wrapping box as well as
       * the `svg`, which is the half that actually holds a Lucide icon in place.
       *
       * There is no fourth size. `xs` (28px) used to sit below `sm` with no
       * counterpart in `Button`, so a dense screen could reach for a control
       * size the rest of the product did not have; its callers are on `sm` now.
       */
      size: {
        sm: 'size-8 rounded-sm',
        md: 'size-10 rounded-md',
        lg: 'size-12 rounded-md',
      },
      shape: {
        default: '',
        pill: 'rounded-full',
      },
    },
    defaultVariants: { variant: 'ghost', size: 'md', shape: 'pill' },
  },
)

const IconButtonSlot = Slot.createSlot<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>('IconButton')

const spinnerForSize = { sm: 'xs', md: 'sm', lg: 'md' } as const

/**
 * The glyph box, and the glyph inside it.
 *
 * Both halves are needed. Sizing only the box is not enough: `lucide-react`
 * ships `width="24" height="24"` as presentation *attributes*, and a
 * presentation attribute loses to any CSS rule but wins against nothing at all —
 * so a 24px icon dropped into a 14px box overflows it by 5px on every side,
 * eating the padding the button variant just reserved and putting every icon in
 * the product at one size regardless of which size was asked for. The
 * `[&_svg]:size-*` half is the CSS that actually constrains the drawing, and it
 * has to travel with the box or the two disagree.
 */
const glyphForSize = {
  sm: 'size-4 [&_svg]:size-4',
  md: 'size-[1.125rem] [&_svg]:size-[1.125rem]',
  lg: 'size-5 [&_svg]:size-5',
} as const

export type IconButtonSize = NonNullable<
  VariantProps<typeof iconButtonVariants>['size']
>

export type IconButtonProps = React.ComponentPropsWithoutRef<'button'> &
  VariantProps<typeof iconButtonVariants> & {
    /** The glyph. Rendered inside a fixed-size box so rows never jitter. */
    icon: React.ReactNode
    /**
     * Required. Becomes the accessible name — an icon-only control with no
     * label is unusable with a screen reader, so it is not optional here.
     */
    label: string
    loading?: boolean
    /** Render as the single child element (a router `Link`, for instance). */
    asChild?: boolean
  }

/**
 * A square, icon-only button. Identical state machine to `Button`, but it
 * insists on an accessible name and locks its own footprint so toolbars keep
 * their rhythm whatever glyph goes in.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      variant,
      size = 'md',
      shape,
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
    const classes = cn(iconButtonVariants({ variant, size, shape }), className)
    const glyph = (
      <span
        className={cn('grid place-items-center', glyphForSize[size ?? 'md'])}
        aria-hidden="true"
      >
        {loading ? (
          <Spinner size={spinnerForSize[size ?? 'md']} label={null} />
        ) : (
          icon
        )}
      </span>
    )

    if (asChild) {
      return (
        <IconButtonSlot
          ref={ref}
          className={cn(
            classes,
            isDisabled && 'pointer-events-none opacity-45 shadow-none',
          )}
          aria-disabled={isDisabled || undefined}
          aria-busy={loading || undefined}
          aria-label={label}
          data-loading={loading ? '' : undefined}
          {...props}
        >
          <Slot.Slottable>{children}</Slot.Slottable>
          {glyph}
        </IconButtonSlot>
      )
    }

    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        className={classes}
        disabled={isDisabled}
        aria-label={label}
        aria-busy={loading || undefined}
        data-loading={loading ? '' : undefined}
        {...props}
      >
        {glyph}
      </button>
    )
  },
)
IconButton.displayName = 'IconButton'
