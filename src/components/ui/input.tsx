import * as React from 'react'
import { X } from 'lucide-react'

import { cn } from '#/lib/cn'
import { Spinner } from './spinner'
import { useFieldControl } from './field'
import {
  fieldSizes,
  focusRing,
  iconBoxes,
  iconSizes,
  transitionBase,
} from './shared'

import type { FieldSize } from './shared'

/** Horizontal room an affix slot needs, per control size. */
const affixWidth = { sm: 'w-8', md: 'w-9', lg: 'w-11' } as const
const leadingPad = { sm: 'pl-8', md: 'pl-9', lg: 'pl-11' } as const
const trailingPad = { sm: 'pr-8', md: 'pr-9', lg: 'pr-11' } as const
const trailingPadWide = { sm: 'pr-14', md: 'pr-16', lg: 'pr-19' } as const
const spinnerForSize = { sm: 'xs', md: 'xs', lg: 'sm' } as const

export type InputProps = Omit<
  React.ComponentPropsWithoutRef<'input'>,
  'size' | 'prefix'
> & {
  size?: FieldSize
  /** Glyph or short unit pinned to the left inside the control. */
  leading?: React.ReactNode
  /** Glyph, unit or `Kbd` hint pinned to the right inside the control. */
  trailing?: React.ReactNode
  /** Forces the invalid treatment without a surrounding `Field`. */
  invalid?: boolean
  /** Swaps the trailing slot for a spinner and marks the control busy. */
  loading?: boolean
  /**
   * Shows a clear button once the control has a value. The caller owns the
   * reset, so it works for controlled and uncontrolled inputs alike.
   */
  onClear?: () => void
  /** Announced on the clear button. */
  clearLabel?: string
  /** Class applied to the positioning wrapper rather than the `<input>`. */
  wrapperClassName?: string
}

/**
 * The single-line text control. The `<input>` itself carries the border, the
 * ring and the invalid state; affixes are absolutely positioned over it, so a
 * leading icon can never nudge the text baseline or change the control height.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      wrapperClassName,
      size = 'md',
      leading,
      trailing,
      invalid,
      loading = false,
      onClear,
      clearLabel = 'Clear',
      type = 'text',
      value,
      defaultValue,
      disabled,
      id,
      'aria-describedby': describedBy,
      'aria-invalid': ariaInvalid,
      ...props
    },
    ref,
  ) => {
    const field = useFieldControl({
      id,
      'aria-describedby': describedBy,
      'aria-invalid': invalid ?? ariaInvalid,
      disabled,
    })

    const [hasText, setHasText] = React.useState(
      () => String(value ?? defaultValue ?? '').length > 0,
    )
    const showClear = Boolean(onClear) && hasText && !loading && !field.disabled
    const rightSlot = loading || showClear || trailing
    const trailingCount = (loading || showClear ? 1 : 0) + (trailing ? 1 : 0)

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      setHasText(event.currentTarget.value.length > 0)
      props.onChange?.(event)
    }

    // A controlled input's emptiness is owned by the caller, not by keystrokes.
    React.useEffect(() => {
      if (value !== undefined) setHasText(String(value).length > 0)
    }, [value])

    return (
      <div
        className={cn('relative flex w-full items-center', wrapperClassName)}
      >
        {leading ? (
          <span
            className={cn(
              'pointer-events-none absolute left-0 grid h-full shrink-0 place-items-center text-ink-4',
              affixWidth[size],
            )}
            aria-hidden="true"
          >
            <span className={cn('grid place-items-center', iconBoxes[size])}>
              {leading}
            </span>
          </span>
        ) : null}

        <input
          ref={ref}
          type={type}
          value={value}
          defaultValue={defaultValue}
          className={cn(
            'w-full min-w-0 rounded-md border border-edge-strong bg-surface text-ink',
            'placeholder:text-ink-4',
            transitionBase,
            'hover:border-ink-4',
            'focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring',
            'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-4 disabled:hover:border-edge-strong',
            'aria-[invalid=true]:border-danger aria-[invalid=true]:outline-danger',
            // Kill the platform chrome on search and number inputs so every
            // control in the product shares one silhouette.
            '[&::-webkit-search-cancel-button]:appearance-none',
            '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
            fieldSizes[size],
            leading && leadingPad[size],
            trailingCount === 1 && trailingPad[size],
            trailingCount === 2 && trailingPadWide[size],
            className,
          )}
          aria-busy={loading || undefined}
          {...props}
          {...field}
          onChange={handleChange}
        />

        {rightSlot ? (
          <span className="absolute right-0 flex h-full items-center gap-0.5 pr-1.5">
            {showClear ? (
              <button
                type="button"
                onClick={onClear}
                aria-label={clearLabel}
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full text-ink-4',
                  transitionBase,
                  focusRing,
                  'hover:bg-hover hover:text-ink active:bg-active',
                )}
              >
                <X size={iconSizes[size]} aria-hidden="true" />
              </button>
            ) : null}
            {loading ? (
              <span className="grid size-6 place-items-center text-ink-4">
                <Spinner size={spinnerForSize[size]} label={null} />
              </span>
            ) : null}
            {trailing ? (
              <span
                className="grid shrink-0 place-items-center px-1 text-caption text-ink-4"
                aria-hidden="true"
              >
                {trailing}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
    )
  },
)
Input.displayName = 'Input'
