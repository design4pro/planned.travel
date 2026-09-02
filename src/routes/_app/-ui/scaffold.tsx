/**
 * Layout furniture shared by the module screens.
 *
 * Nothing here fetches data or owns product logic — these are the repeated
 * arrangements of design-system primitives that make every module read as one
 * designed product rather than twelve separately-styled pages.
 */
import { Card, SectionLabel, Skeleton, SkeletonText } from '#/components/ui'
import { cn } from '#/lib/cn'
import { useTranslate } from '#/lib/i18n'

import type { ComponentPropsWithoutRef, ReactNode } from 'react'

/* ------------------------------------------------------------------- panels */

export interface PanelProps {
  /** The tracked label that opens every panel in the product. */
  label: string
  /** A quiet count beside the label — `12`, `3 of 8`. */
  count?: string
  /** Trailing control on the header row. */
  action?: ReactNode
  /** Sub-header row: filters, a search box, a progress bar. */
  toolbar?: ReactNode
  children: ReactNode
  /**
   * Pinned under the body, above the card's foot — a composer, a total, a "load
   * more". Kept out of `children` so a scrolling body cannot scroll it away.
   */
  footer?: ReactNode
  /** `flush` lets rows run to the card's edge so dividers span it fully. */
  flush?: boolean
  className?: string
  bodyClassName?: string
}

/**
 * A titled card. `flush` drops the body padding so a list of `PanelRow`s can
 * carry full-bleed hairlines between its rows.
 */
export function Panel({
  label,
  count,
  action,
  toolbar,
  children,
  footer,
  flush = false,
  className,
  bodyClassName,
}: PanelProps) {
  return (
    <Card padding="none" className={cn('flex min-w-0 flex-col', className)}>
      <div className="flex flex-col gap-3 px-5 pt-4 pb-3">
        <div className="flex min-h-6 items-center justify-between gap-3">
          <div className="flex min-w-0 items-baseline gap-2">
            <SectionLabel as="h2">{label}</SectionLabel>
            {count === undefined ? null : (
              <span className="shrink-0 text-caption tabular-nums text-ink-4">
                {count}
              </span>
            )}
          </div>
          {action === undefined ? null : (
            <div className="shrink-0">{action}</div>
          )}
        </div>
        {toolbar === undefined ? null : (
          <div className="min-w-0">{toolbar}</div>
        )}
      </div>
      <div
        className={cn(
          'min-w-0 flex-1 border-t border-edge-faint',
          flush ? '' : 'px-5 py-4',
          bodyClassName,
        )}
      >
        {children}
      </div>
      {footer === undefined ? null : (
        <div className="min-w-0 shrink-0 border-t border-edge-faint px-5 py-3.5">
          {footer}
        </div>
      )}
    </Card>
  )
}

/** One row inside a `flush` panel. Hairlines between, never after the last. */
export function PanelRow({
  children,
  className,
  ...rest
}: ComponentPropsWithoutRef<'div'> & { children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-3 px-5 py-3.5 not-last:border-b not-last:border-edge-faint',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

/* -------------------------------------------------------------------- meta */

export interface MetaItem {
  readonly label: string
  readonly value: ReactNode
}

/**
 * The label-over-value block the reference uses on booking and transport cards.
 * A definition list, so a screen reader hears the pairing.
 */
export function MetaGrid({
  items,
  columns = 2,
  className,
}: {
  items: ReadonlyArray<MetaItem>
  columns?: 1 | 2 | 3 | 4
  className?: string
}) {
  if (items.length === 0) {
    return null
  }
  return (
    <dl
      className={cn(
        'grid gap-3',
        columns === 1 && 'grid-cols-1',
        columns === 2 && 'grid-cols-1 sm:grid-cols-2',
        columns === 3 && 'grid-cols-1 sm:grid-cols-3',
        columns === 4 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="mb-1 text-micro font-semibold uppercase tracking-label text-ink-4">
            {item.label}
          </dt>
          <dd className="rounded-sm bg-surface-2 px-3 py-2 text-label text-ink">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** A compact inline run of `label · value` pairs, separated by hairlines. */
export function MetaStrip({
  items,
  className,
}: {
  items: ReadonlyArray<MetaItem>
  className?: string
}) {
  if (items.length === 0) {
    return null
  }
  return (
    <dl
      className={cn('flex flex-wrap items-center gap-x-5 gap-y-2', className)}
    >
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 items-baseline gap-2">
          <dt className="text-micro font-semibold uppercase tracking-label text-ink-4">
            {item.label}
          </dt>
          <dd className="truncate text-label font-medium tabular-nums text-ink">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * The hero stat strip: oversized display numerals on a recessed band, the way
 * the up-next trip card presents its dates and counts.
 */
export function StatStrip({
  items,
  className,
}: {
  items: ReadonlyArray<{ label: string; value: ReactNode; hint?: ReactNode }>
  className?: string
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-inverse-edge sm:grid-cols-4',
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="min-w-0 bg-inverse-surface px-4 py-3.5 text-center"
        >
          <dt className="mb-1.5 truncate text-micro font-semibold uppercase tracking-label text-inverse-muted">
            {item.label}
          </dt>
          <dd className="font-display text-display leading-none font-bold tracking-tighter tabular-nums text-inverse-on">
            {item.value}
          </dd>
          {item.hint === undefined ? null : (
            <p className="mt-1.5 truncate text-caption text-inverse-muted">
              {item.hint}
            </p>
          )}
        </div>
      ))}
    </dl>
  )
}

/* --------------------------------------------------------------- skeletons */

/** Rows of avatar-plus-two-lines, sized to the real list rows they replace. */
export function RowsSkeleton({
  rows = 4,
  className,
}: {
  rows?: number
  className?: string
}) {
  const t = useTranslate()
  return (
    <div aria-busy="true" className={cn('flex flex-col', className)}>
      <span className="sr-only">{t('ui.status.loading')}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 px-5 py-3.5 not-last:border-b not-last:border-edge-faint"
        >
          <Skeleton className="size-9 shrink-0" radius="lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-2/5" radius="sm" />
            <Skeleton className="h-2.5 w-3/5" radius="sm" />
          </div>
          <Skeleton className="h-3 w-14 shrink-0" radius="sm" />
        </div>
      ))}
    </div>
  )
}

/** A grid of card-shaped blocks — the trips, collections and journey indexes. */
export function CardsSkeleton({
  cards = 6,
  className,
}: {
  cards?: number
  className?: string
}) {
  const t = useTranslate()
  return (
    <div
      aria-busy="true"
      className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-3', className)}
    >
      <span className="sr-only">{t('ui.status.loading')}</span>
      {Array.from({ length: cards }, (_, index) => (
        <Card key={index} padding="none" className="overflow-hidden">
          <Skeleton className="h-28 w-full rounded-none" />
          <div className="space-y-3 p-5">
            <Skeleton className="h-3 w-20" radius="sm" />
            <Skeleton className="h-5 w-3/5" radius="sm" />
            <SkeletonText lines={2} />
          </div>
        </Card>
      ))}
    </div>
  )
}

/** The four-across stat row every module opens with. */
export function StatsSkeleton({
  tiles = 4,
  className,
}: {
  tiles?: number
  className?: string
}) {
  const t = useTranslate()
  return (
    <div
      aria-busy="true"
      className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}
    >
      <span className="sr-only">{t('ui.status.loading')}</span>
      {Array.from({ length: tiles }, (_, index) => (
        <Card key={index} className="space-y-4">
          <Skeleton className="h-3 w-24" radius="sm" />
          <Skeleton className="h-10 w-24" radius="sm" />
          <Skeleton className="h-2.5 w-32" radius="sm" />
        </Card>
      ))}
    </div>
  )
}

/** The page-title band, so the header does not pop in after the body. */
export function HeaderSkeleton({ className }: { className?: string }) {
  const t = useTranslate()
  return (
    <Card
      aria-busy="true"
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-center',
        className,
      )}
    >
      <span className="sr-only">{t('ui.status.loading')}</span>
      <div className="space-y-2.5">
        <Skeleton className="h-3 w-24" radius="sm" />
        <Skeleton className="h-7 w-52" radius="sm" />
      </div>
      <Skeleton className="h-10 w-32 sm:ms-auto" radius="full" />
    </Card>
  )
}

/* ----------------------------------------------------------------- filters */

/**
 * A segmented filter rendered as real links, so each view is addressable,
 * shareable and works with the back button. `Chip` is a button and cannot do
 * that, which is why this is a class helper rather than a component.
 */
export function filterLinkClass(active: boolean): string {
  return cn(
    // Chip's `md` recipe, by hand: the two are drawn side by side on the same
    // rows, so the type step has to move with it. `text-label` rather than
    // `text-caption` is that step.
    'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-label font-semibold whitespace-nowrap focus-ring',
    'transition-[background-color,border-color,color] duration-base ease-out-quint',
    active
      ? 'border-transparent bg-accent text-accent-on'
      : 'border-edge bg-surface text-ink-2 hover:border-edge-strong hover:text-ink',
  )
}

/** The scrolling row the filter links sit in. */
export function FilterBar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'scrollbar-none -mx-1 flex items-center gap-2 overflow-x-auto px-1',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** The small count that rides inside an active filter link. */
export function FilterCount({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-current/15 px-1.5 text-micro leading-4 tabular-nums">
      {children}
    </span>
  )
}
