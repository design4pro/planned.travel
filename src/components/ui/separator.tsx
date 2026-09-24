import * as React from 'react'
import * as SeparatorPrimitive from 'radix-ui/separator'

import { cn } from '#/lib/cn'

export type SeparatorProps = React.ComponentPropsWithoutRef<
  typeof SeparatorPrimitive.Root
> & {
  /** Centred text or glyph inside the rule — "or", a date, a count. */
  label?: React.ReactNode
  /** `faint` for inside a card, `strong` for a structural division. */
  weight?: 'faint' | 'default'
}

/**
 * A hairline. Decorative by default — Radix drops it from the accessibility
 * tree unless `decorative={false}`, which is right for a rule that only exists
 * to give the eye a rest.
 */
export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  (
    {
      className,
      orientation = 'horizontal',
      label,
      weight = 'default',
      ...props
    },
    ref,
  ) => {
    const line = weight === 'faint' ? 'bg-edge-faint' : 'bg-edge'

    if (label && orientation === 'horizontal') {
      return (
        <div className={cn('flex items-center gap-3', className)}>
          <SeparatorPrimitive.Root
            ref={ref}
            orientation="horizontal"
            className={cn('h-px flex-1', line)}
            {...props}
          />
          <span className="shrink-0 text-micro font-semibold uppercase tracking-label text-ink-4">
            {label}
          </span>
          <SeparatorPrimitive.Root
            orientation="horizontal"
            aria-hidden="true"
            className={cn('h-px flex-1', line)}
          />
        </div>
      )
    }

    return (
      <SeparatorPrimitive.Root
        ref={ref}
        orientation={orientation}
        className={cn(
          'shrink-0',
          orientation === 'horizontal'
            ? 'h-px w-full'
            : 'h-full w-px self-stretch',
          line,
          className,
        )}
        {...props}
      />
    )
  },
)
Separator.displayName = 'Separator'
