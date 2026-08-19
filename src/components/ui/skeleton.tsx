import * as React from 'react'

import { cn } from '#/lib/cn'

const radii = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
} as const

export type SkeletonProps = React.ComponentPropsWithoutRef<'div'> & {
  radius?: keyof typeof radii
  /** `shimmer` sweeps a highlight across the block; `pulse` breathes opacity. */
  animation?: 'shimmer' | 'pulse' | 'none'
}

/**
 * A placeholder block. Always `aria-hidden` with the surrounding region marked
 * `aria-busy`, so a screen reader hears "loading" once instead of narrating a
 * dozen empty boxes.
 */
export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, radius = 'md', animation = 'shimmer', ...props }, ref) => (
    <div
      ref={ref}
      aria-hidden="true"
      data-motion-loop={animation === 'shimmer' ? '' : undefined}
      className={cn(
        'relative overflow-hidden bg-surface-inset',
        radii[radius],
        animation === 'pulse' && 'animate-pulse-soft',
        animation === 'shimmer' &&
          'before:absolute before:inset-0 before:animate-shimmer before:bg-linear-to-r before:from-transparent before:via-surface/60 before:to-transparent',
        className,
      )}
      {...props}
    />
  ),
)
Skeleton.displayName = 'Skeleton'

export type SkeletonTextProps = React.ComponentPropsWithoutRef<'div'> & {
  lines?: number
  /** Width of the final line, so a paragraph does not end in a suspicious block. */
  lastLineWidth?: string
  animation?: SkeletonProps['animation']
}

export const SkeletonText = React.forwardRef<HTMLDivElement, SkeletonTextProps>(
  (
    { className, lines = 3, lastLineWidth = '62%', animation, ...props },
    ref,
  ) => (
    <div ref={ref} className={cn('flex flex-col gap-2', className)} {...props}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          radius="sm"
          animation={animation}
          className="h-3"
          style={index === lines - 1 ? { width: lastLineWidth } : undefined}
        />
      ))}
    </div>
  ),
)
SkeletonText.displayName = 'SkeletonText'

export type SkeletonCardProps = React.ComponentPropsWithoutRef<'div'> & {
  /** Reserves room for a leading avatar or thumbnail. */
  media?: boolean
  lines?: number
}

/**
 * The loading shape of one list row. It matches the real row's metrics, so the
 * swap from skeleton to content shifts nothing.
 */
export const SkeletonCard = React.forwardRef<HTMLDivElement, SkeletonCardProps>(
  ({ className, media = true, lines = 2, ...props }, ref) => (
    <div
      ref={ref}
      aria-busy="true"
      className={cn(
        'flex items-start gap-3 rounded-xl border border-edge-faint bg-surface p-4',
        className,
      )}
      {...props}
    >
      {media ? <Skeleton radius="md" className="size-10 shrink-0" /> : null}
      <div className="min-w-0 flex-1 space-y-2.5">
        <Skeleton radius="sm" className="h-3.5 w-2/5" />
        <SkeletonText lines={lines} />
      </div>
    </div>
  ),
)
SkeletonCard.displayName = 'SkeletonCard'
