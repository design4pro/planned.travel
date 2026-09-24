import * as React from 'react'
import * as SwitchPrimitive from 'radix-ui/switch'

import { cn } from '#/lib/cn'
import { useFieldControl } from './field'
import { useUiI18n } from './copy'
import { disabledState, focusRing, transitionBase } from './shared'

const trackSizes = {
  sm: 'h-4.5 w-8',
  md: 'h-5.5 w-9.5',
  lg: 'h-6.5 w-11.5',
} as const

const thumbSizes = {
  sm: 'size-3.5',
  md: 'size-4.5',
  lg: 'size-5.5',
} as const

/**
 * How far the thumb travels, per size, and why it is a custom property.
 *
 * The travel is a transform, so no logical property covers it: under `dir="rtl"`
 * the track is mirrored and an unchanged `translate-x` would slide the thumb
 * straight out of it. Two competing utilities would not settle the question
 * either — Tailwind v4 compiles `rtl:` to a zero-specificity `:where()`, so
 * `rtl:-translate-x-4` beside `translate-x-4` is decided by whichever the
 * compiler emits last. A single signed value, resolved once from the negotiated
 * direction, has no such ambiguity.
 */
const thumbTravel = { sm: '0.875rem', md: '1rem', lg: '1.25rem' } as const

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
    const { dir } = useUiI18n()
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
          style={
            {
              '--thumb-travel': `${dir === 'rtl' ? '-' : ''}${thumbTravel[size]}`,
            } as React.CSSProperties
          }
          className={cn(
            'pointer-events-none block rounded-full bg-surface shadow-card',
            'transition-transform duration-fast ease-out-quint',
            'data-[state=unchecked]:translate-x-0',
            'data-[state=checked]:translate-x-(--thumb-travel)',
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
