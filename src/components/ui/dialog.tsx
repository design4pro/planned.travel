import * as React from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { X } from 'lucide-react'

import { cn } from '#/lib/cn'
import { IconButton } from './icon-button'
import { overlaySurface } from './shared'

const contentSizes = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[calc(100vw-2rem)]',
} as const

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const DialogPortal = DialogPrimitive.Portal

export const DialogOverlay = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(overlaySurface, className)}
    {...props}
  />
))
DialogOverlay.displayName = 'DialogOverlay'

export type DialogContentProps = React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> & {
  size?: keyof typeof contentSizes
  /** Hides the built-in close affordance when the footer already owns dismissal. */
  hideClose?: boolean
  closeLabel?: string
  /** Class for the overlay behind the panel. */
  overlayClassName?: string
}

/**
 * The modal panel. Focus is trapped and restored, Escape and outside-press
 * close it, the page behind is inert, and the entrance is a 12px rise with a
 * 2% scale — enough to read as arriving, not enough to feel like a toy.
 *
 * On a narrow viewport it pins to the bottom of the screen and squares off its
 * lower corners, so a phone gets a sheet rather than a shrunken desktop modal.
 */
export const DialogContent = React.forwardRef<
  HTMLDivElement,
  DialogContentProps
>(
  (
    {
      className,
      overlayClassName,
      size = 'md',
      hideClose = false,
      closeLabel = 'Close',
      onOpenAutoFocus,
      onCloseAutoFocus,
      children,
      ...props
    },
    ref,
  ) => {
    /**
     * Where focus goes when the panel closes.
     *
     * Radix restores focus to a `Dialog.Trigger`, and most panels in this product
     * are opened from state instead — a row menu item, a toolbar button that also
     * sets which panel to show — so there is no trigger to restore to and closing
     * dropped focus on `<body>`, sending a keyboard reader back to the top of the
     * page. Remembering whatever was focused when the panel opened covers both
     * shapes, and a caller's own handler still wins.
     */
    const opener = React.useRef<HTMLElement | null>(null)
    return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      {/* A non-interactive centring frame. Keeping the panel free of layout
          transforms is what lets the entrance animation own `transform`
          outright, with no fight between centring and choreography. */}
      <div className="pointer-events-none fixed inset-0 z-modal flex items-end justify-center sm:items-center sm:p-4">
        <DialogPrimitive.Content
          ref={ref}
          data-motion-transform=""
          className={cn(
            'pointer-events-auto relative flex w-full flex-col overflow-hidden bg-surface text-ink shadow-modal',
            'max-h-[92dvh] rounded-t-2xl border-t border-edge-faint pb-safe',
            'sm:max-h-[85dvh] sm:rounded-xl sm:border sm:pb-0',
            'data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out',
            contentSizes[size],
            className,
          )}
          onOpenAutoFocus={(event) => {
            opener.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null
            onOpenAutoFocus?.(event)
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
          {children}
          {hideClose ? null : (
            <DialogPrimitive.Close asChild>
              <IconButton
                icon={<X />}
                label={closeLabel}
                size="sm"
                variant="ghost"
                className="absolute top-3.5 right-3.5"
              />
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </div>
    </DialogPortal>
    )
  },
)
DialogContent.displayName = 'DialogContent'

/** Fixed band at the top of the panel. Never scrolls with the body. */
export const DialogHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'shrink-0 border-b border-edge-faint px-5 py-4 pr-14 sm:px-6 sm:py-5',
      className,
    )}
    {...props}
  />
))
DialogHeader.displayName = 'DialogHeader'

export const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('font-display text-title text-ink', className)}
    {...props}
  />
))
DialogTitle.displayName = 'DialogTitle'

export const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('mt-1.5 text-label text-ink-3', className)}
    {...props}
  />
))
DialogDescription.displayName = 'DialogDescription'

/** The scrolling middle. Overscroll is contained so the page never rubber-bands. */
export const DialogBody = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'min-h-0 flex-1 overscroll-contain overflow-y-auto px-5 py-5 sm:px-6',
      className,
    )}
    {...props}
  />
))
DialogBody.displayName = 'DialogBody'

/**
 * Fixed band at the bottom. Actions are reversed on mobile so the primary sits
 * at the bottom, under the thumb, and stacks full-width.
 */
export const DialogFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'shrink-0 border-t border-edge-faint bg-surface px-5 py-4 sm:px-6',
      'flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-end sm:gap-3',
      '[&>*]:w-full sm:[&>*]:w-auto',
      className,
    )}
    {...props}
  />
))
DialogFooter.displayName = 'DialogFooter'
