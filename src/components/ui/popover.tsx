import * as React from 'react'
import * as PopoverPrimitive from 'radix-ui/popover'

import { cn } from '#/lib/cn'
import { popMotion } from './shared'

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverAnchor = PopoverPrimitive.Anchor
export const PopoverClose = PopoverPrimitive.Close
export const PopoverPortal = PopoverPrimitive.Portal

const paddings = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-5' } as const

export type PopoverContentProps = React.ComponentPropsWithoutRef<
  typeof PopoverPrimitive.Content
> & {
  padding?: keyof typeof paddings
  /** Draws the little pointer at the trigger edge. */
  arrow?: boolean
}

/**
 * The floating panel. Grows out of its trigger — Radix exposes the
 * trigger-relative transform origin, so the entrance reads as the panel
 * unfolding from the control rather than fading in from nowhere.
 */
export const PopoverContent = React.forwardRef<
  HTMLDivElement,
  PopoverContentProps
>(
  (
    {
      className,
      padding = 'md',
      arrow = false,
      align = 'center',
      sideOffset = 8,
      children,
      ...props
    },
    ref,
  ) => (
    <PopoverPortal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        data-motion-transform=""
        className={cn(
          'z-popover w-72 max-w-[calc(100vw-1.5rem)] rounded-lg border border-edge bg-surface text-ink shadow-popover',
          'max-h-(--radix-popover-content-available-height) overflow-y-auto overscroll-contain',
          popMotion,
          paddings[padding],
          className,
        )}
        {...props}
      >
        {children}
        {arrow ? (
          <PopoverPrimitive.Arrow
            className="fill-surface [&>path]:stroke-edge [&>path]:stroke-1"
            width={12}
            height={6}
          />
        ) : null}
      </PopoverPrimitive.Content>
    </PopoverPortal>
  ),
)
PopoverContent.displayName = 'PopoverContent'

/** Title row for a popover that is doing the job of a small dialog. */
export const PopoverHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'mb-3 flex items-center justify-between gap-3 text-label font-semibold text-ink',
      className,
    )}
    {...props}
  />
))
PopoverHeader.displayName = 'PopoverHeader'
