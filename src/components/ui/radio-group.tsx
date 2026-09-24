import * as React from 'react'
import * as RadioGroupPrimitive from 'radix-ui/radio-group'
import { Check } from 'lucide-react'

import { cn } from '#/lib/cn'
import { useField } from './field'
import { disabledState, focusRing, transitionBase } from './shared'

const dotSizes = { sm: 'size-4', md: 'size-5' } as const
const innerSizes = { sm: 'size-1.5', md: 'size-2' } as const

export type RadioGroupProps = React.ComponentPropsWithoutRef<
  typeof RadioGroupPrimitive.Root
>

/**
 * Arrow keys move *and* select, roving tabindex, one tab stop for the whole
 * group — Radix's roving focus, so the group behaves like a native radio set.
 */
export const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, ...props }, ref) => {
    const field = useField()
    const inherited = [field?.errorId, field?.hintId].filter(Boolean).join(' ')
    return (
      <RadioGroupPrimitive.Root
        ref={ref}
        aria-describedby={
          props['aria-describedby'] ??
          (inherited === '' ? undefined : inherited)
        }
        className={cn('grid gap-2.5', className)}
        {...props}
      />
    )
  },
)
RadioGroup.displayName = 'RadioGroup'

export type RadioProps = React.ComponentPropsWithoutRef<
  typeof RadioGroupPrimitive.Item
> & {
  size?: keyof typeof dotSizes
}

/** The dot only, for callers composing their own row. */
export const Radio = React.forwardRef<HTMLButtonElement, RadioProps>(
  ({ className, size = 'md', ...props }, ref) => (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        'grid shrink-0 place-items-center rounded-full border border-edge-strong bg-surface',
        transitionBase,
        focusRing,
        disabledState,
        'hover:border-ink-4',
        'data-[state=checked]:border-brand data-[state=checked]:bg-brand',
        'data-[state=checked]:hover:bg-brand-hover',
        'active:scale-95 motion-reduce:active:scale-100',
        dotSizes[size],
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-motion-transform=""
        className={cn(
          'block rounded-full bg-brand-on animate-pop-in',
          innerSizes[size],
        )}
      />
    </RadioGroupPrimitive.Item>
  ),
)
Radio.displayName = 'Radio'

export type RadioGroupItemProps = RadioProps & {
  label: React.ReactNode
  description?: React.ReactNode
  wrapperClassName?: string
}

/** Dot plus label as one hit target. */
export const RadioGroupItem = React.forwardRef<
  HTMLButtonElement,
  RadioGroupItemProps
>(
  (
    {
      label,
      description,
      wrapperClassName,
      id,
      size = 'md',
      className,
      ...props
    },
    ref,
  ) => {
    const generated = React.useId()
    const controlId = id ?? `radio-${generated}`
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
        <Radio
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
RadioGroupItem.displayName = 'RadioGroupItem'

export type RadioCardProps = React.ComponentPropsWithoutRef<
  typeof RadioGroupPrimitive.Item
> & {
  label: React.ReactNode
  description?: React.ReactNode
  /** Leading glyph or illustration. */
  icon?: React.ReactNode
  /** Right-aligned metadata — a price, a badge, a duration. */
  meta?: React.ReactNode
}

/**
 * The bordered, selectable panel used for plan pickers and trip templates. It
 * is a real radio item, so the whole card is one arrow-navigable option rather
 * than a div with an onClick.
 */
export const RadioCard = React.forwardRef<HTMLButtonElement, RadioCardProps>(
  ({ className, label, description, icon, meta, ...props }, ref) => (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        'group relative flex w-full items-start gap-3 rounded-lg border border-edge bg-surface p-4 text-start',
        transitionBase,
        focusRing,
        disabledState,
        'hover:border-edge-strong hover:bg-surface-2',
        'data-[state=checked]:border-brand data-[state=checked]:bg-brand-subtle',
        'data-[state=checked]:shadow-card',
        className,
      )}
      {...props}
    >
      {icon ? (
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-md bg-surface-2 text-ink-2',
            transitionBase,
            'group-data-[state=checked]:bg-brand group-data-[state=checked]:text-brand-on',
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
      ) : null}

      <span className="min-w-0 flex-1">
        <span className="block text-label font-semibold text-ink">{label}</span>
        {description ? (
          <span className="mt-1 block text-caption text-ink-3">
            {description}
          </span>
        ) : null}
      </span>

      {meta ? (
        <span className="shrink-0 text-label font-semibold text-ink">
          {meta}
        </span>
      ) : null}

      <RadioGroupPrimitive.Indicator asChild>
        <span
          className="absolute -top-1.5 -end-1.5 grid size-5 place-items-center rounded-full bg-brand text-brand-on shadow-card animate-pop-in"
          data-motion-transform=""
        >
          <Check size={12} strokeWidth={3} aria-hidden="true" />
        </span>
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  ),
)
RadioCard.displayName = 'RadioCard'
