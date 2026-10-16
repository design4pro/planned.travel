import * as React from 'react'
import * as Slot from 'radix-ui/slot'
import { cva } from 'class-variance-authority'

import { cn } from '#/lib/cn'
import { Spinner } from './spinner'
import {
  inactiveButtonChild,
  suppressButtonActivation,
  suppressButtonKey,
} from './button-interaction'
import { useUiCopy } from './copy'
import { disabledLabelled, focusRing, transitionBase } from './shared'

import type { VariantProps } from 'class-variance-authority'

export const buttonVariants = cva(
  [
    'relative inline-flex shrink-0 items-center justify-center whitespace-nowrap',
    'font-semibold select-none',
    focusRing,
    transitionBase,
    disabledLabelled,
    // A 1px press, never a bounce. The shadow steps down with it, so the
    // control reads as pushed into the page rather than as shrinking.
    'active:translate-y-px',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        /** Near-black (near-white in dark). The one loud button on a screen. */
        primary:
          'bg-accent text-accent-on shadow-card hover:bg-accent-hover hover:shadow-elevated active:shadow-card disabled:bg-surface-inset disabled:text-ink-4',
        /** Hairline on surface. The default for anything that is not the main action. */
        secondary:
          'border border-edge-strong bg-surface text-ink shadow-card hover:border-ink-4 hover:bg-surface-2 active:bg-surface-inset active:shadow-none disabled:border-edge disabled:bg-surface-2 disabled:text-ink-4',
        /** No chrome until touched. Toolbars, table rows, card affordances. */
        ghost:
          'text-ink-2 hover:bg-hover hover:text-ink active:bg-active disabled:text-ink-4',
        /** A quiet filled chip. Sits inside a card without competing with it. */
        subtle:
          'bg-surface-2 text-ink hover:bg-surface-inset active:bg-surface-inset/70 disabled:text-ink-4',
        /** Destructive confirmation. Never the resting state of a row action. */
        danger:
          'bg-danger text-danger-on shadow-card hover:bg-danger/90 hover:shadow-elevated active:shadow-card disabled:bg-surface-inset disabled:text-ink-4',
        /** Brand fill for marketing and onboarding calls to action. */
        brand:
          'bg-brand text-brand-on shadow-card hover:bg-brand-hover hover:shadow-elevated active:shadow-card disabled:bg-surface-inset disabled:text-ink-4',
        /** For use on an inverse (near-black) panel. */
        inverse:
          'bg-inverse-surface text-inverse-on ring-1 ring-inverse-edge ring-inset hover:bg-inverse-on/15 disabled:text-inverse-muted',
        /** Reads as a link, behaves as a button. */
        link: 'text-brand underline decoration-brand/35 underline-offset-4 hover:decoration-brand active:translate-y-0 disabled:text-ink-4 disabled:no-underline',
      },
      /**
       * Three sizes, and each one owns its type step and its icon.
       *
       * The heights are the 32/40/48 ladder they always were; what moved is the
       * type, one step up at every size (13/15/18 rather than 12/13/15). A 12px
       * label inside a 32px control reads as a chip rather than as a button,
       * and the old scale spent two of its three steps below the body size.
       *
       * The icon size is declared here rather than left to the call site, which
       * is the fix for the real inconsistency: the component only ever set
       * `shrink-0`, so every caller picked its own glyph size and the product
       * ran 14, 16, 18 and 20px icons inside identically sized buttons. The
       * descendant selector outranks a class on the `svg` itself, so a caller
       * that still passes `size-4` is overridden rather than in conflict.
       */
      size: {
        sm: 'h-8 gap-1.5 rounded-sm px-3.5 text-label [&_svg]:size-3.5',
        md: 'h-10 gap-2 rounded-md px-4 text-body [&_svg]:size-4',
        lg: 'h-12 gap-2.5 rounded-md px-5 text-subtitle [&_svg]:size-4.5',
      },
      shape: {
        default: '',
        pill: 'rounded-full',
      },
      block: {
        true: 'w-full',
        false: '',
      },
    },
    compoundVariants: [
      { variant: 'link', size: 'sm', class: 'h-auto px-0' },
      { variant: 'link', size: 'md', class: 'h-auto px-0' },
      { variant: 'link', size: 'lg', class: 'h-auto px-0' },
    ],
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
      shape: 'default',
      block: false,
    },
  },
)

/**
 * The same repaint the `disabled:` utilities above apply, keyed by variant.
 *
 * `asChild` renders an anchor or a router `Link`, and neither ever matches
 * `:disabled`, so the inactive look has to be applied as plain classes. Keeping
 * it beside the variants is what stops the two paths drifting apart.
 */
const disabledByVariant: Record<ButtonVariant, string> = {
  primary: 'bg-surface-inset text-ink-4 shadow-none',
  secondary: 'border-edge bg-surface-2 text-ink-4 shadow-none',
  ghost: 'text-ink-4',
  subtle: 'text-ink-4',
  danger: 'bg-surface-inset text-ink-4 shadow-none',
  brand: 'bg-surface-inset text-ink-4 shadow-none',
  inverse: 'text-inverse-muted',
  link: 'text-ink-4 no-underline',
}

/** A Slot typed for button elements, so `asChild` keeps a real ref type. */
const ButtonSlot = Slot.createSlot<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>('Button')

export type ButtonVariant = NonNullable<
  VariantProps<typeof buttonVariants>['variant']
>
export type ButtonSize = NonNullable<
  VariantProps<typeof buttonVariants>['size']
>

export type ButtonProps = React.ComponentPropsWithoutRef<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Leading glyph. Sized by the button, so pass a bare `lucide-react` icon. */
    icon?: React.ReactNode
    /** Trailing glyph — a chevron, a count, an external-link mark. */
    iconAfter?: React.ReactNode
    /**
     * Swaps the label for a centred spinner while keeping the button's measured
     * width, so a pending action never reflows the row it sits in.
     */
    loading?: boolean
    /** Overrides what is announced while `loading`. Left out, it says "Working". */
    loadingLabel?: string
    /** Render as the single child element (a router `Link`, for instance). */
    asChild?: boolean
  }

const spinnerForSize = { sm: 'xs', md: 'sm', lg: 'md' } as const

/**
 * The workhorse control. Every variant ships rest, hover, focus-visible,
 * active, disabled and loading, in both themes.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size = 'md',
      shape,
      block,
      icon,
      iconAfter,
      loading = false,
      loadingLabel,
      asChild = false,
      disabled = false,
      type,
      children,
      ...props
    },
    ref,
  ) => {
    const t = useUiCopy()
    const isDisabled = disabled || loading
    const classes = cn(
      buttonVariants({ variant, size, shape, block }),
      className,
    )

    if (asChild) {
      return (
        <ButtonSlot
          ref={ref}
          className={cn(
            classes,
            isDisabled && [
              'pointer-events-none',
              disabledByVariant[variant ?? 'secondary'],
            ],
          )}
          data-loading={loading ? '' : undefined}
          {...props}
          aria-busy={loading || props['aria-busy'] || undefined}
          aria-disabled={isDisabled || props['aria-disabled'] || undefined}
          onClickCapture={
            isDisabled ? suppressButtonActivation : props.onClickCapture
          }
          onKeyDownCapture={
            isDisabled ? suppressButtonKey : props.onKeyDownCapture
          }
          onKeyUpCapture={isDisabled ? suppressButtonKey : props.onKeyUpCapture}
        >
          {/* `Slottable` marks the element to clone, so the icons below are
              injected as that element's children instead of replacing it. */}
          {loading ? (
            <Spinner size={spinnerForSize[size ?? 'md']} label={null} />
          ) : (
            icon
          )}
          <Slot.Slottable>
            {inactiveButtonChild(children, isDisabled, loading)}
          </Slot.Slottable>
          {iconAfter}
        </ButtonSlot>
      )
    }

    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        className={classes}
        disabled={disabled}
        data-loading={loading ? '' : undefined}
        {...props}
        aria-busy={loading || props['aria-busy'] || undefined}
        aria-disabled={isDisabled || props['aria-disabled'] || undefined}
        onClickCapture={
          isDisabled ? suppressButtonActivation : props.onClickCapture
        }
        onKeyDownCapture={
          isDisabled ? suppressButtonKey : props.onKeyDownCapture
        }
        onKeyUpCapture={isDisabled ? suppressButtonKey : props.onKeyUpCapture}
      >
        {loading ? (
          <span className="absolute inset-0 grid place-items-center">
            <Spinner size={spinnerForSize[size ?? 'md']} label={null} />
          </span>
        ) : null}
        <span
          className={cn(
            'inline-flex items-center justify-center gap-[inherit]',
            loading && 'invisible',
          )}
        >
          {icon}
          {children}
          {iconAfter}
        </span>
        {loading ? (
          <span className="sr-only">
            {loadingLabel ?? t('ui.status.working')}
          </span>
        ) : null}
      </button>
    )
  },
)
Button.displayName = 'Button'
