import * as React from 'react'
import * as CheckboxPrimitive from 'radix-ui/checkbox'
import { Check, Minus } from 'lucide-react'

import { cn } from '#/lib/cn'
import { useFieldControl } from './field'
import { disabledState, focusRing, transitionBase } from './shared'

const boxSizes = { sm: 'size-4 rounded-sm', md: 'size-5 rounded-sm' } as const
const glyphSizes = { sm: 11, md: 14 } as const

export type CheckboxProps = Omit<
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
  'children'
> & {
  size?: keyof typeof boxSizes
  invalid?: boolean
}

/**
 * The box only. `checked="indeterminate"` renders the dash and reports
 * `aria-checked="mixed"`, which is what a partially-selected parent row in a
 * packing list needs.
 */
export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, size = 'md', invalid, disabled, id, ...props }, ref) => {
    const field = useFieldControl({
      id,
      'aria-describedby': props['aria-describedby'],
      'aria-invalid': invalid,
      disabled,
    })

    return (
      <CheckboxPrimitive.Root
        ref={ref}
        className={cn(
          'group grid shrink-0 place-items-center border border-edge-strong bg-surface',
          transitionBase,
          focusRing,
          disabledState,
          'hover:border-ink-4',
          'data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-accent-on',
          'data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent data-[state=indeterminate]:text-accent-on',
          'data-[state=checked]:hover:bg-accent-hover data-[state=indeterminate]:hover:bg-accent-hover',
          'active:scale-95 motion-reduce:active:scale-100',
          'aria-[invalid=true]:border-danger',
          boxSizes[size],
          className,
        )}
        {...props}
        {...field}
      >
        <CheckboxPrimitive.Indicator
          className="grid place-items-center data-[state=checked]:animate-pop-in"
          data-motion-transform=""
        >
          <Check
            size={glyphSizes[size]}
            strokeWidth={3}
            aria-hidden="true"
            className="hidden group-data-[state=checked]:block"
          />
          <Minus
            size={glyphSizes[size]}
            strokeWidth={3}
            aria-hidden="true"
            className="hidden group-data-[state=indeterminate]:block"
          />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    )
  },
)
Checkbox.displayName = 'Checkbox'

export type CheckboxFieldProps = CheckboxProps & {
  /** The clickable label beside the box. */
  label: React.ReactNode
  /** Quiet second line under the label. */
  description?: React.ReactNode
  /** Class for the wrapping label element. */
  wrapperClassName?: string
}

/**
 * Box plus label as one hit target — the form is the label, so the whole row
 * toggles and the accessible name comes from real text rather than an
 * `aria-label` that nobody keeps in sync.
 */
export const CheckboxField = React.forwardRef<
  HTMLButtonElement,
  CheckboxFieldProps
>(
  (
    {
      label,
      description,
      wrapperClassName,
      className,
      size = 'md',
      id,
      ...props
    },
    ref,
  ) => {
    const generated = React.useId()
    const controlId = id ?? `checkbox-${generated}`
    const labelId = `${controlId}-label`
    const descriptionId = description ? `${controlId}-description` : undefined

    return (
      <label
        htmlFor={controlId}
        className={cn(
          'flex cursor-pointer items-start gap-3 select-none',
          'has-disabled:cursor-not-allowed has-disabled:opacity-60',
          wrapperClassName,
        )}
      >
        <Checkbox
          ref={ref}
          id={controlId}
          size={size}
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
          className={cn(size === 'md' ? 'mt-px' : 'mt-0.5', className)}
          {...props}
        />
        <span className="min-w-0">
          <span id={labelId} className="block text-label font-medium text-ink">
            {label}
          </span>
          {description ? (
            <span
              id={descriptionId}
              className="mt-0.5 block text-caption text-ink-3"
            >
              {description}
            </span>
          ) : null}
        </span>
      </label>
    )
  },
)
CheckboxField.displayName = 'CheckboxField'
