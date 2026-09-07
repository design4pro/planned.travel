import * as React from 'react'
import { ContextMenu as ContextMenuPrimitive } from 'radix-ui'
import { Check, ChevronRight, Circle } from 'lucide-react'

import { cn } from '#/lib/cn'
import {
  layerSurface,
  menuItemBase,
  menuLabelBase,
  menuSeparatorBase,
  popMotion,
} from './shared'

/**
 * Right-click (and long-press on touch) actions for a row on the planner or a
 * marker on the map. Identical vocabulary to `DropdownMenu`, so a row can offer
 * the same actions through both affordances from one list of definitions.
 */
export const ContextMenu = ContextMenuPrimitive.Root
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger
export const ContextMenuGroup = ContextMenuPrimitive.Group
export const ContextMenuSub = ContextMenuPrimitive.Sub
export const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup

export const ContextMenuContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content
      ref={ref}
      data-motion-transform=""
      className={cn(
        layerSurface,
        popMotion,
        'z-popover min-w-48 max-h-(--radix-context-menu-content-available-height)',
        'overflow-y-auto overscroll-contain p-1',
        className,
      )}
      {...props}
    />
  </ContextMenuPrimitive.Portal>
))
ContextMenuContent.displayName = 'ContextMenuContent'

export type ContextMenuItemProps = React.ComponentPropsWithoutRef<
  typeof ContextMenuPrimitive.Item
> & {
  icon?: React.ReactNode
  shortcut?: React.ReactNode
  destructive?: boolean
  inset?: boolean
}

export const ContextMenuItem = React.forwardRef<
  HTMLDivElement,
  ContextMenuItemProps
>(
  (
    {
      className,
      icon,
      shortcut,
      destructive = false,
      inset = false,
      children,
      ...props
    },
    ref,
  ) => (
    <ContextMenuPrimitive.Item
      ref={ref}
      className={cn(
        menuItemBase,
        destructive &&
          'text-danger data-[highlighted]:bg-danger-soft data-[highlighted]:text-danger',
        inset && 'ps-8',
        className,
      )}
      {...props}
    >
      {icon ? (
        <span
          className="grid size-4 shrink-0 place-items-center opacity-70 [&_svg]:size-4"
          aria-hidden="true"
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut ? (
        <span className="ms-auto shrink-0 text-caption tracking-wide text-ink-4">
          {shortcut}
        </span>
      ) : null}
    </ContextMenuPrimitive.Item>
  ),
)
ContextMenuItem.displayName = 'ContextMenuItem'

export const ContextMenuCheckboxItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.CheckboxItem>
>(({ className, children, ...props }, ref) => (
  <ContextMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(menuItemBase, 'ps-8', className)}
    {...props}
  >
    <ContextMenuPrimitive.ItemIndicator className="absolute start-2.5 grid place-items-center text-brand">
      <Check size={14} strokeWidth={3} aria-hidden="true" />
    </ContextMenuPrimitive.ItemIndicator>
    <span className="min-w-0 flex-1 truncate">{children}</span>
  </ContextMenuPrimitive.CheckboxItem>
))
ContextMenuCheckboxItem.displayName = 'ContextMenuCheckboxItem'

export const ContextMenuRadioItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <ContextMenuPrimitive.RadioItem
    ref={ref}
    className={cn(menuItemBase, 'ps-8', className)}
    {...props}
  >
    <ContextMenuPrimitive.ItemIndicator className="absolute start-2.5 grid place-items-center text-brand">
      <Circle size={7} className="fill-current" aria-hidden="true" />
    </ContextMenuPrimitive.ItemIndicator>
    <span className="min-w-0 flex-1 truncate">{children}</span>
  </ContextMenuPrimitive.RadioItem>
))
ContextMenuRadioItem.displayName = 'ContextMenuRadioItem'

export const ContextMenuLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Label
    ref={ref}
    className={cn(menuLabelBase, className)}
    {...props}
  />
))
ContextMenuLabel.displayName = 'ContextMenuLabel'

export const ContextMenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator
    ref={ref}
    className={cn(menuSeparatorBase, className)}
    {...props}
  />
))
ContextMenuSeparator.displayName = 'ContextMenuSeparator'

export const ContextMenuSubTrigger = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger>
>(({ className, children, ...props }, ref) => (
  <ContextMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      menuItemBase,
      'data-[state=open]:bg-hover data-[state=open]:text-ink',
      className,
    )}
    {...props}
  >
    <span className="min-w-0 flex-1 truncate">{children}</span>
    <ChevronRight
      size={14}
      className="ms-auto shrink-0 text-ink-4"
      aria-hidden="true"
      data-mirror-rtl
    />
  </ContextMenuPrimitive.SubTrigger>
))
ContextMenuSubTrigger.displayName = 'ContextMenuSubTrigger'

export const ContextMenuSubContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.SubContent
      ref={ref}
      data-motion-transform=""
      className={cn(
        layerSurface,
        popMotion,
        'z-popover min-w-44 p-1',
        className,
      )}
      {...props}
    />
  </ContextMenuPrimitive.Portal>
))
ContextMenuSubContent.displayName = 'ContextMenuSubContent'
