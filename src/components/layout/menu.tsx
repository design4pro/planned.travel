import { Check } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { cn } from '#/lib/cn'

import type { ComponentPropsWithoutRef } from 'react'

/**
 * One styled Radix dropdown, shared by the theme switcher, the notification
 * tray and the user menu, so every menu in the chrome opens the same way.
 * Enter transition uses `@starting-style`; browsers without it simply show the
 * menu instantly rather than animating.
 */

export const MenuRoot = DropdownMenu.Root
export const MenuTrigger = DropdownMenu.Trigger
export const MenuGroup = DropdownMenu.Group

const contentClass = cn(
  'z-dropdown min-w-56 overflow-hidden rounded-lg border border-edge-faint bg-surface p-1.5 text-ink shadow-dropdown',
  'transition-[opacity,transform] duration-fast ease-out-quint',
  'starting:opacity-0 starting:scale-[0.97]',
  'data-[side=bottom]:origin-top data-[side=top]:origin-bottom',
)

export function MenuContent({
  className,
  align = 'end',
  sideOffset = 8,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(contentClass, className)}
        {...props}
      />
    </DropdownMenu.Portal>
  )
}

const itemClass = cn(
  'relative flex cursor-default select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-label text-ink-2 outline-none',
  'transition-[background-color,color] duration-fast ease-out-quint',
  'data-[highlighted]:bg-hover data-[highlighted]:text-ink',
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-45',
)

export function MenuItem({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenu.Item>) {
  return <DropdownMenu.Item className={cn(itemClass, className)} {...props} />
}

export function MenuDangerItem({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenu.Item>) {
  return (
    <DropdownMenu.Item
      className={cn(
        itemClass,
        'text-danger data-[highlighted]:bg-danger-soft data-[highlighted]:text-danger',
        className,
      )}
      {...props}
    />
  )
}

export function MenuRadioGroup({
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenu.RadioGroup>) {
  return <DropdownMenu.RadioGroup {...props} />
}

export function MenuRadioItem({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenu.RadioItem>) {
  return (
    <DropdownMenu.RadioItem
      className={cn(itemClass, 'pe-8', className)}
      {...props}
    >
      {children}
      <DropdownMenu.ItemIndicator className="absolute end-2.5 flex items-center text-brand">
        <Check className="size-4" strokeWidth={2.5} />
      </DropdownMenu.ItemIndicator>
    </DropdownMenu.RadioItem>
  )
}

export function MenuLabel({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenu.Label>) {
  return (
    <DropdownMenu.Label
      className={cn(
        'px-2.5 pb-1.5 pt-2 text-micro uppercase text-ink-4',
        className,
      )}
      {...props}
    />
  )
}

export function MenuSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenu.Separator>) {
  return (
    <DropdownMenu.Separator
      className={cn('-mx-1.5 my-1.5 h-px bg-edge', className)}
      {...props}
    />
  )
}
