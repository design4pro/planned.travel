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
        'pb-[calc(var(--safe-bottom)+6rem)] lg:pb-16',
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
