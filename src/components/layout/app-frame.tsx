import { cn } from '#/lib/cn'

import type { ReactNode } from 'react'

export interface AppFrameProps {
  children: ReactNode
  /**
   * Full-bleed pages (map surfaces) own their whole viewport slice: no max
   * width, no padding, no bottom gutter.
   */
  bleed?: boolean
  className?: string
}

/**
 * The single content well every module renders into. Bottom padding clears the
 * mobile tab bar plus the device's safe area, so nothing is ever parked under
 * a home indicator.
 *
 * Below `lg` it also clears the "Report a problem" actor, which floats in the
 * end corner directly above the bar (`#sentry-feedback` in
 * `src/styles/styles.css`). Measured at 393px its top edge is 132px above the
 * viewport's foot, so a well padded only for the bar (6rem) left the last row's
 * end-aligned controls under it once the page was scrolled to the end — a
 * file's Actions button could not be reached at all (issue #557). 8.5rem is the
 * same clearance the import widget in `book/import-widget.tsx` sits at.
 */
export function AppFrame({
  children,
  bleed = false,
  className,
}: AppFrameProps) {
  if (bleed) {
    return <main className={cn('relative flex-1', className)}>{children}</main>
  }

  return (
    <main
      className={cn(
        'mx-auto w-full max-w-content flex-1 px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8',
        'pb-[calc(var(--safe-bottom)+8.5rem)] lg:pb-16',
        className,
      )}
    >
      {children}
    </main>
  )
}

/** Vertical rhythm helper so every module stacks its sections identically. */
export function AppSections({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-6 lg:gap-8', className)}>
      {children}
    </div>
  )
}
