import * as React from 'react'
import { Switch as SwitchPrimitive } from 'radix-ui'

import { cn } from '#/lib/cn'
import { useFieldControl } from './field'
import { disabledState, focusRing, transitionBase } from './shared'

const trackSizes = {
  sm: 'h-4.5 w-8',
  md: 'h-5.5 w-9.5',
  lg: 'h-6.5 w-11.5',
} as const

const thumbSizes = {
  sm: 'size-3.5 data-[state=checked]:translate-x-3.5',
  md: 'size-4.5 data-[state=checked]:translate-x-4',
  lg: 'size-5.5 data-[state=checked]:translate-x-5',
} as const

export type SwitchProps = React.ComponentPropsWithoutRef<
  typeof SwitchPrimitive.Root
> & {
  size?: keyof typeof trackSizes
}

/**
 * An instant on/off. Reserved for settings that apply immediately — anything
 * that needs a Save button is a `Checkbox`, not a switch.
 */
export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, size = 'md', disabled, id, ...props }, ref) => {
    const field = useFieldControl({
      id,
      'aria-describedby': props['aria-describedby'],
      disabled,
    })

    return (
      <SwitchPrimitive.Root
        ref={ref}
        className={cn(
          'relative inline-flex shrink-0 items-center rounded-full border border-transparent p-0.5',
          'bg-surface-inset ring-1 ring-edge-strong/60 ring-inset',
          transitionBase,
          focusRing,
          disabledState,
          'hover:bg-edge/70',
          'data-[state=checked]:bg-brand data-[state=checked]:ring-transparent data-[state=checked]:hover:bg-brand-hover',
          trackSizes[size],
          className,
        )}
        {...props}
        {...field}
      >
        <SwitchPrimitive.Thumb
          data-motion-transform=""
          className={cn(
            'pointer-events-none block rounded-full bg-surface shadow-card',
            'transition-transform duration-fast ease-out-quint',
            'data-[state=unchecked]:translate-x-0',
            thumbSizes[size],
          )}
        />
      </SwitchPrimitive.Root>
    )
  },
)
Switch.displayName = 'Switch'

export type SwitchFieldProps = SwitchProps & {
  label: React.ReactNode
  description?: React.ReactNode
  wrapperClassName?: string
}

/**
 * The settings row: label and explanation on the left, switch pinned right.
 */
export const SwitchField = React.forwardRef<
  HTMLButtonElement,
  SwitchFieldProps
>(({ label, description, wrapperClassName, id, ...props }, ref) => {
  const generated = React.useId()
  const controlId = id ?? `switch-${generated}`
  const labelId = `${controlId}-label`
  const descriptionId = description ? `${controlId}-description` : undefined

  return (
    <label
      htmlFor={controlId}
      className={cn(
        'flex cursor-pointer items-center justify-between gap-4 select-none',
        'has-disabled:cursor-not-allowed has-disabled:opacity-60',
        wrapperClassName,
      )}
    >
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
      <Switch
        ref={ref}
        id={controlId}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        {...props}
      />
    </label>
  )
})
SwitchField.displayName = 'SwitchField'
