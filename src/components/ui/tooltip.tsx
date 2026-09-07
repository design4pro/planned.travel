import * as React from 'react'
import { Tooltip as TooltipPrimitive } from 'radix-ui'

import { cn } from '#/lib/cn'

/**
 * Mount once, high in the tree: the provider is what makes the second tooltip
 * in a toolbar appear instantly instead of waiting out the delay again.
 */
export const TooltipProvider = TooltipPrimitive.Provider
export const TooltipRoot = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger
export const TooltipPortal = TooltipPrimitive.Portal

export type TooltipContentProps = React.ComponentPropsWithoutRef<
  typeof TooltipPrimitive.Content
>

export const TooltipContent = React.forwardRef<
  HTMLDivElement,
  TooltipContentProps
>(({ className, sideOffset = 6, children, ...props }, ref) => (
  <TooltipPortal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      data-motion-transform=""
      className={cn(
        'z-tooltip max-w-64 origin-(--radix-tooltip-content-transform-origin) rounded-sm px-2 py-1.5',
        'bg-inverse text-caption font-medium text-inverse-on shadow-elevated',
        'data-[state=delayed-open]:animate-tooltip-in data-[state=instant-open]:animate-tooltip-in',
        'data-[state=closed]:animate-tooltip-out',
        className,
      )}
      {...props}
    >
      {children}
    </TooltipPrimitive.Content>
  </TooltipPortal>
))
TooltipContent.displayName = 'TooltipContent'

export type TooltipProps = Omit<
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>,
  'children'
> & {
  /** The hint. A tooltip is never the only place a fact appears. */
  content: React.ReactNode
  /** The control being described. Must be focusable to be reachable. */
  children: React.ReactNode
  side?: TooltipContentProps['side']
  align?: TooltipContentProps['align']
  sideOffset?: number
  contentClassName?: string
  /** Keyboard hint rendered to the right of the label. */
  shortcut?: React.ReactNode
}

/**
 * The one-call form. Wraps a single focusable child; the hint is announced as
 * that control's description, so it is reachable by keyboard and by screen
 * reader rather than being hover-only decoration.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  sideOffset,
  contentClassName,
  shortcut,
  delayDuration = 250,
  ...props
}: TooltipProps) {
  return (
    <TooltipRoot delayDuration={delayDuration} {...props}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={contentClassName}
      >
        <span className="flex items-center gap-2">
          <span>{content}</span>
          {shortcut ? (
            <span className="text-caption font-semibold text-inverse-muted">
              {shortcut}
            </span>
          ) : null}
        </span>
      </TooltipContent>
    </TooltipRoot>
  )
}
