import * as React from 'react'
import { Drawer } from 'vaul'
import { X } from 'lucide-react'

import { cn } from '#/lib/cn'
import { IconButton } from './icon-button'
import { useUiI18n } from './copy'

import type { Direction } from '#/lib/i18n'

/**
 * The draggable drawer. `vaul` gives it the physics — velocity-aware dismissal,
 * snap points, and input repositioning when the on-screen keyboard appears —
 * on top of Radix Dialog, so focus trapping and Escape still behave.
 *
 * Bottom is the mobile default; `side="end"` is the desktop detail panel — the
 * physical right in English and the physical left in Arabic.
 *
 * The four physical edges, and why they stay physical.
 *
 * `vaul` needs `direction` on the root to know which way the drag goes, and its
 * vocabulary is physical. The classes below are physical for the same reason and
 * are *correct* that way: a sheet pinned to the physical left edge rounds its
 * physical right corners in every script, because that is the edge facing the
 * page. Swapping them for logical properties would round the wrong corners in
 * Arabic.
 *
 * What is genuinely direction-dependent is which edge a *detail panel* should
 * come from, and that is what `start` and `end` are for.
 */
const sideClasses = {
  bottom:
    'inset-x-0 bottom-0 mt-24 max-h-[92dvh] rounded-t-2xl border-t pb-safe',
  top: 'inset-x-0 top-0 mb-24 max-h-[92dvh] rounded-b-2xl border-b pt-safe',
  left: 'inset-y-0 left-0 w-full max-w-md rounded-r-2xl border-r',
  right: 'inset-y-0 right-0 w-full max-w-md rounded-l-2xl border-l',
} as const

/** A physical edge `vaul` and `sideClasses` both understand. */
export type PhysicalEdge = keyof typeof sideClasses

/**
 * `start` and `end` are the inline edges: `end` is the right in English and the
 * left in Arabic, which is where a detail panel belongs in either. Give `Sheet`
 * and `SheetContent` the same one and both the anchor and the drag follow the
 * reader.
 */
export type SheetSide = PhysicalEdge | 'start' | 'end'

/** The one place a logical edge becomes a physical one. */
function physicalEdge(side: SheetSide, dir: Direction): PhysicalEdge {
  if (side === 'start') return dir === 'rtl' ? 'right' : 'left'
  if (side === 'end') return dir === 'rtl' ? 'left' : 'right'
  return side
}

export const Sheet = Drawer.Root

/**
 * The physical `direction` a logical `side` needs on the root — the one thing
 * `vaul` cannot work out for itself.
 *
 * `vaul` reads `direction` to know which axis the drag runs along and which way
 * a release dismisses, and its vocabulary is physical: there is no `end`. Left to
 * the caller, that arithmetic produced a panel anchored to the correct edge that
 * dragged the *wrong* way in Arabic — the gesture that should have dismissed it
 * pushed it further open. So the sum lives here, next to the `sideClasses` it has
 * to agree with:
 *
 * ```tsx
 * const direction = useSheetDirection('end')
 * <Sheet direction={direction}>
 *   <SheetContent side="end">…</SheetContent>
 * </Sheet>
 * ```
 *
 * It is a hook rather than a wrapper around `Drawer.Root` because `vaul` types
 * its root props as a discriminated union — snap points and `fadeFromIndex` are
 * mutually exclusive — and a wrapper that re-spreads them collapses the union
 * and stops type-checking the very props it forwards.
 */
export function useSheetDirection(side: SheetSide): PhysicalEdge {
  const { dir } = useUiI18n()
  return physicalEdge(side, dir)
}

export const SheetTrigger = Drawer.Trigger
export const SheetClose = Drawer.Close
export const SheetPortal = Drawer.Portal
export const NestedSheet = Drawer.NestedRoot

export const SheetOverlay = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof Drawer.Overlay>
>(({ className, ...props }, ref) => (
  <Drawer.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-overlay bg-overlay', className)}
    {...props}
  />
))
SheetOverlay.displayName = 'SheetOverlay'

export type SheetContentProps = React.ComponentPropsWithoutRef<
  typeof Drawer.Content
> & {
  /**
   * Which edge the sheet is anchored to. Prefer the logical `start`/`end`, and
   * give the root the matching `direction` from `useSheetDirection(side)`.
   */
  side?: SheetSide
  /** Shows the grab handle. On by default for the bottom sheet. */
  handle?: boolean
  hideClose?: boolean
  closeLabel?: string
  overlayClassName?: string
}

export const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  (
    {
      className,
      overlayClassName,
      side = 'bottom',
      handle,
      hideClose = false,
      closeLabel,
      onOpenAutoFocus,
      onCloseAutoFocus,
      children,
      ...props
    },
    ref,
  ) => {
    const { dir, t } = useUiI18n()
    const physicalSide = physicalEdge(side, dir)
    const showHandle = handle ?? physicalSide === 'bottom'
    /**
     * Where focus goes when the sheet closes.
     *
     * Radix restores focus to a `Sheet.Trigger`, and a sheet driven from state —
     * two buttons opening one panel on a different tab, which is how the planner
     * works — has no trigger to restore to, so closing dropped focus on `<body>`
     * and a keyboard reader lost their place on the page. Remembering whatever was
     * focused at open time covers both shapes.
     */
    const opener = React.useRef<HTMLElement | null>(null)
    return (
      <SheetPortal>
        <SheetOverlay className={overlayClassName} />
        <Drawer.Content
          ref={ref}
          className={cn(
            'fixed z-modal flex flex-col border-edge bg-surface text-ink shadow-modal outline-none',
            sideClasses[physicalSide],
            className,
          )}
          /**
           * Focus lands on the panel, not on the trigger behind it.
           *
           * `vaul` suppresses Radix's own open-autofocus — it would focus the
           * first field, summon the on-screen keyboard and fight the drag
           * physics. But suppressing it entirely left focus on the trigger, which
           * the dialog had just buried under `aria-hidden`: a screen reader
           * announced nothing, and Tab resumed from a hidden element. Focusing
           * the content itself fixes both without opening a keyboard, because the
           * panel is `tabIndex={-1}` and holds no text cursor.
           */
          onOpenAutoFocus={(event) => {
            opener.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null
            onOpenAutoFocus?.(event)
            if (event.defaultPrevented) return
            const node = event.currentTarget
            if (node instanceof HTMLElement) {
              node.focus({ preventScroll: true })
            }
          }}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event)
            if (event.defaultPrevented) return
            const target = opener.current
            opener.current = null
            if (target === null || !target.isConnected) return
            event.preventDefault()
            target.focus({ preventScroll: true })
          }}
          {...props}
        >
          {showHandle ? (
            <Drawer.Handle className="mx-auto mt-3 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-edge-strong/50" />
          ) : null}
          {children}
          {hideClose ? null : (
            <Drawer.Close asChild>
              <IconButton
                icon={<X />}
                label={closeLabel ?? t('ui.action.close')}
                size="sm"
                variant="ghost"
                className="absolute top-3.5 end-3.5"
              />
            </Drawer.Close>
          )}
        </Drawer.Content>
      </SheetPortal>
    )
  },
)
SheetContent.displayName = 'SheetContent'

export const SheetHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'shrink-0 border-b border-edge-faint px-5 py-4 pe-14',
      className,
    )}
    {...props}
  />
))
SheetHeader.displayName = 'SheetHeader'

export const SheetTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<typeof Drawer.Title>
>(({ className, ...props }, ref) => (
  <Drawer.Title
    ref={ref}
    className={cn('font-display text-title text-ink', className)}
    {...props}
  />
))
SheetTitle.displayName = 'SheetTitle'

export const SheetDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof Drawer.Description>
>(({ className, ...props }, ref) => (
  <Drawer.Description
    ref={ref}
    className={cn('mt-1.5 text-label text-ink-3', className)}
    {...props}
  />
))
SheetDescription.displayName = 'SheetDescription'

export const SheetBody = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'min-h-0 flex-1 overscroll-contain overflow-y-auto px-5 py-5',
      className,
    )}
    {...props}
  />
))
SheetBody.displayName = 'SheetBody'

export const SheetFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'shrink-0 border-t border-edge-faint bg-surface px-5 py-4',
      'flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-end sm:gap-3',
      '[&>*]:w-full sm:[&>*]:w-auto',
      className,
    )}
    {...props}
  />
))
SheetFooter.displayName = 'SheetFooter'
