import * as React from 'react'
import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui'

import { cn } from '#/lib/cn'
import { transitionBase } from './shared'

export const ScrollAreaRoot = ScrollAreaPrimitive.Root
export const ScrollAreaViewport = ScrollAreaPrimitive.Viewport
export const ScrollAreaCorner = ScrollAreaPrimitive.Corner

export type ScrollBarProps = React.ComponentPropsWithoutRef<
  typeof ScrollAreaPrimitive.Scrollbar
>

export const ScrollBar = React.forwardRef<HTMLDivElement, ScrollBarProps>(
  ({ className, orientation = 'vertical', ...props }, ref) => (
    <ScrollAreaPrimitive.Scrollbar
      ref={ref}
      orientation={orientation}
      className={cn(
        'flex touch-none p-0.5 select-none',
        transitionBase,
        'data-[state=hidden]:opacity-0',
        orientation === 'vertical' ? 'w-2.5' : 'h-2.5 flex-col',
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        className={cn(
          'relative flex-1 rounded-full bg-scrollbar-thumb',
          transitionBase,
          'hover:bg-scrollbar-thumb-hover',
        )}
      />
    </ScrollAreaPrimitive.Scrollbar>
  ),
)
ScrollBar.displayName = 'ScrollBar'

export type ScrollAreaProps = React.ComponentPropsWithoutRef<
  typeof ScrollAreaPrimitive.Root
> & {
  /** Which axes may scroll. Horizontal adds its own bar. */
  axis?: 'vertical' | 'horizontal' | 'both'
  /**
   * Fades the content out at the scrollable edges — the cue that tells a reader
   * there is more below without stealing a row of space for a shadow.
   */
  fade?: boolean
  viewportClassName?: string
}

/**
 * A scroll container with our own bars: 10px, inset, rounded, and invisible
 * until the pointer is near. macOS-style overlay behaviour on every platform,
 * with the native keyboard and wheel behaviour untouched.
 */
export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  (
    {
      className,
      viewportClassName,
      axis = 'vertical',
      fade = false,
      children,
      ...props
    },
    ref,
  ) => (
    <ScrollAreaPrimitive.Root
      ref={ref}
      scrollHideDelay={400}
      className={cn(
        'relative overflow-hidden',
        fade &&
          '[mask-image:linear-gradient(to_bottom,transparent,black_var(--space-4),black_calc(100%-var(--space-4)),transparent)]',
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        className={cn(
          'size-full rounded-[inherit]',
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
          viewportClassName,
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {axis !== 'horizontal' ? <ScrollBar orientation="vertical" /> : null}
      {axis !== 'vertical' ? <ScrollBar orientation="horizontal" /> : null}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  ),
)
ScrollArea.displayName = 'ScrollArea'
