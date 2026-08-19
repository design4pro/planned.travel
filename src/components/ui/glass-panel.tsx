import * as React from 'react'
import { Slot } from 'radix-ui'
import { cva } from 'class-variance-authority'

import { cn } from '#/lib/cn'
import { transitionSlow } from './shared'

import type { VariantProps } from 'class-variance-authority'

export const glassPanelVariants = cva(
  [
    // The three ingredients that make a panel read as floating glass: a
    // translucent ground, a blur that samples what is behind it, and a hairline
    // that is brighter than the fill so the edge catches light.
    'relative bg-glass text-ink backdrop-glass',
    'ring-1 ring-glass-edge ring-inset shadow-glass',
    transitionSlow,
  ],
  {
    variants: {
      radius: {
        md: 'rounded-md',
        lg: 'rounded-lg',
        xl: 'rounded-xl',
        '2xl': 'rounded-2xl',
        full: 'rounded-full',
      },
      padding: {
        none: '',
        xs: 'p-1.5',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-5',
      },
      /** Elevates it above the map's own controls. */
      floating: {
        true: 'z-dropdown',
        false: '',
      },
    },
    defaultVariants: { radius: 'xl', padding: 'md', floating: true },
  },
)

const GlassSlot = Slot.createSlot<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>('GlassPanel')

export type GlassPanelProps = React.ComponentPropsWithoutRef<'div'> &
  VariantProps<typeof glassPanelVariants> & {
    asChild?: boolean
  }

/**
 * The translucent panel that floats over the map: the itinerary rail, the place
 * inspector, the layer switcher. It is deliberately not a `Card` variant —
 * glass needs its own ground, its own edge and its own shadow to survive being
 * laid over satellite imagery in either theme.
 */
export const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  (
    { className, radius, padding, floating, asChild = false, ...props },
    ref,
  ) => {
    const Comp = asChild ? GlassSlot : 'div'
    return (
      <Comp
        ref={ref}
        className={cn(
          glassPanelVariants({ radius, padding, floating }),
          className,
        )}
        {...props}
      />
    )
  },
)
GlassPanel.displayName = 'GlassPanel'

export type GlassToolbarProps = React.ComponentPropsWithoutRef<'div'> & {
  orientation?: 'horizontal' | 'vertical'
  /** Accessible name for the group of controls. */
  label: string
}

/**
 * The pill-shaped strip of map controls — category filters, zoom, basemap. A
 * real `toolbar` role, so arrow keys are expected to move between its buttons
 * and the whole strip is one tab stop for the reader.
 */
export const GlassToolbar = React.forwardRef<HTMLDivElement, GlassToolbarProps>(
  ({ className, orientation = 'horizontal', label, ...props }, ref) => (
    <div
      ref={ref}
      role="toolbar"
      aria-label={label}
      aria-orientation={orientation}
      className={cn(
        glassPanelVariants({ radius: 'full', padding: 'xs' }),
        'flex items-center gap-0.5',
        orientation === 'vertical' && 'flex-col',
        className,
      )}
      {...props}
    />
  ),
)
GlassToolbar.displayName = 'GlassToolbar'

export type GlassPanelHeaderProps = React.ComponentPropsWithoutRef<'div'> & {
  action?: React.ReactNode
}

/** Title row for a glass panel, with a hairline that matches the glass edge. */
export const GlassPanelHeader = React.forwardRef<
  HTMLDivElement,
  GlassPanelHeaderProps
>(({ className, action, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex items-center justify-between gap-3 border-b border-glass-edge pb-3',
      className,
    )}
    {...props}
  >
    <span className="min-w-0 truncate text-label font-semibold text-ink">
      {children}
    </span>
    {action ? <span className="shrink-0">{action}</span> : null}
  </div>
))
GlassPanelHeader.displayName = 'GlassPanelHeader'
