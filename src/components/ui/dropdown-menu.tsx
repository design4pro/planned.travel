import * as React from 'react'
import { DropdownMenu as MenuPrimitive } from 'radix-ui'
import { Check, ChevronRight, Circle } from 'lucide-react'

import { cn } from '#/lib/cn'
import {
  layerSurface,
  menuItemBase,
  menuLabelBase,
  menuSeparatorBase,
  popMotion,
} from './shared'

export const DropdownMenu = MenuPrimitive.Root
export const DropdownMenuTrigger = MenuPrimitive.Trigger
export const DropdownMenuGroup = MenuPrimitive.Group
export const DropdownMenuPortal = MenuPrimitive.Portal
export const DropdownMenuSub = MenuPrimitive.Sub
export const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup

export type DropdownMenuContentProps = React.ComponentPropsWithoutRef<
  typeof MenuPrimitive.Content
>

export const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  DropdownMenuContentProps
>(({ className, sideOffset = 6, align = 'end', ...props }, ref) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      align={align}
      data-motion-transform=""
      className={cn(
        layerSurface,
        popMotion,
        'z-popover min-w-52 max-h-(--radix-dropdown-menu-content-available-height)',
        'overflow-y-auto overscroll-contain p-1',
        className,
      )}
      {...props}
    />
  </MenuPrimitive.Portal>
))
DropdownMenuContent.displayName = 'DropdownMenuContent'

export type DropdownMenuItemProps = React.ComponentPropsWithoutRef<
  typeof MenuPrimitive.Item
> & {
  icon?: React.ReactNode
  /** Right-aligned keyboard hint. Pair it with a real handler, never decorative. */
  shortcut?: React.ReactNode
  /** The red treatment. Reserved for actions that lose data. */
  destructive?: boolean
  /** Aligns the label with items that have icons, without giving this one. */
  inset?: boolean
}

export const DropdownMenuItem = React.forwardRef<
  HTMLDivElement,
  DropdownMenuItemProps
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
    <MenuPrimitive.Item
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
    </MenuPrimitive.Item>
  ),
)
DropdownMenuItem.displayName = 'DropdownMenuItem'

export type DropdownMenuCheckboxItemProps = React.ComponentPropsWithoutRef<
  typeof MenuPrimitive.CheckboxItem
>

export const DropdownMenuCheckboxItem = React.forwardRef<
  HTMLDivElement,
  DropdownMenuCheckboxItemProps
>(({ className, children, ...props }, ref) => (
  <MenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(menuItemBase, 'ps-8', className)}
    {...props}
  >
    <MenuPrimitive.ItemIndicator className="absolute start-2.5 grid place-items-center text-brand">
      <Check size={14} strokeWidth={3} aria-hidden="true" />
    </MenuPrimitive.ItemIndicator>
    <span className="min-w-0 flex-1 truncate">{children}</span>
  </MenuPrimitive.CheckboxItem>
))
DropdownMenuCheckboxItem.displayName = 'DropdownMenuCheckboxItem'

export const DropdownMenuRadioItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <MenuPrimitive.RadioItem
    ref={ref}
    className={cn(menuItemBase, 'ps-8', className)}
    {...props}
  >
    <MenuPrimitive.ItemIndicator className="absolute start-2.5 grid place-items-center text-brand">
      <Circle size={7} className="fill-current" aria-hidden="true" />
    </MenuPrimitive.ItemIndicator>
    <span className="min-w-0 flex-1 truncate">{children}</span>
  </MenuPrimitive.RadioItem>
))
DropdownMenuRadioItem.displayName = 'DropdownMenuRadioItem'

export const DropdownMenuLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <MenuPrimitive.Label
    ref={ref}
    className={cn(menuLabelBase, className)}
    {...props}
  />
))
DropdownMenuLabel.displayName = 'DropdownMenuLabel'

export const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <MenuPrimitive.Separator
    ref={ref}
    className={cn(menuSeparatorBase, className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator'

export type DropdownMenuSubTriggerProps = React.ComponentPropsWithoutRef<
  typeof MenuPrimitive.SubTrigger
> & { icon?: React.ReactNode }

export const DropdownMenuSubTrigger = React.forwardRef<
  HTMLDivElement,
  DropdownMenuSubTriggerProps
>(({ className, icon, children, ...props }, ref) => (
  <MenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      menuItemBase,
      'data-[state=open]:bg-hover data-[state=open]:text-ink',
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
    <ChevronRight
      size={14}
      className="ms-auto shrink-0 text-ink-4"
      aria-hidden="true"
      data-mirror-rtl
    />
  </MenuPrimitive.SubTrigger>
))
DropdownMenuSubTrigger.displayName = 'DropdownMenuSubTrigger'

export const DropdownMenuSubContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.SubContent>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.SubContent
      ref={ref}
      sideOffset={sideOffset}
      data-motion-transform=""
      className={cn(
        layerSurface,
        popMotion,
        'z-popover min-w-44 p-1',
        className,
      )}
      {...props}
    />
  </MenuPrimitive.Portal>
))
DropdownMenuSubContent.displayName = 'DropdownMenuSubContent'
