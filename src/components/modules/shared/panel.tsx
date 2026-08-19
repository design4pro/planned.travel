/**
 * The titled card every module section sits in.
 *
 * Structurally identical to the panel the read-only module screens already use —
 * a `Card` with a tracked label, a quiet count, a trailing control, an optional
 * toolbar row and an optional pinned footer — so an interactive screen and a
 * static one read as the same product. It lives here rather than being imported
 * out of a route directory so the interactive modules own their own chrome.
 */
import { Card, SectionLabel } from '#/components/ui'
import { cn } from '#/lib/cn'

import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export interface ModulePanelProps {
  /** The tracked label that opens every panel in the product. */
  label: ReactNode
  /** A quiet count beside the label — `12`, `3 of 8`. */
  count?: string
  /** Trailing control on the header row. */
  action?: ReactNode
  /** Sub-header row: filters, a search box, a progress bar. */
  toolbar?: ReactNode
  children: ReactNode
  /**
   * Pinned under the body, above the card's foot — a composer, a total, an "add
   * item" row. Kept out of `children` so a scrolling body cannot scroll it away.
   */
  footer?: ReactNode
  /** `flush` drops the body padding so rows can carry full-bleed hairlines. */
  flush?: boolean
  /** Dims and blocks the body while a write covering the whole panel is in flight. */
  busy?: boolean
  className?: string
  bodyClassName?: string
}

export function ModulePanel({
  label,
  count,
  action,
  toolbar,
  children,
  footer,
  flush = false,
  busy = false,
  className,
  bodyClassName,
}: ModulePanelProps) {
  return (
    <Card padding="none" className={cn('flex min-w-0 flex-col', className)}>
      <div className="flex flex-col gap-3 px-5 pt-4 pb-3">
        <div className="flex min-h-6 items-center justify-between gap-3">
          <div className="flex min-w-0 items-baseline gap-2">
            <SectionLabel as="h2" className="truncate">
              {label}
            </SectionLabel>
            {count === undefined ? null : (
              <span className="shrink-0 text-caption tabular-nums text-ink-4">
                {count}
              </span>
            )}
          </div>
          {action === undefined ? null : (
            <div className="flex shrink-0 items-center gap-1">{action}</div>
          )}
        </div>
        {toolbar === undefined ? null : (
          <div className="min-w-0">{toolbar}</div>
        )}
      </div>
      <div
        aria-busy={busy ? true : undefined}
        className={cn(
          'min-w-0 flex-1 border-t border-edge-faint',
          flush ? '' : 'px-5 py-4',
          busy && 'pointer-events-none opacity-60',
          'transition-opacity duration-base ease-out-quint',
          bodyClassName,
        )}
      >
        {children}
      </div>
      {footer === undefined ? null : (
        <div className="min-w-0 shrink-0 border-t border-edge-faint px-5 py-3">
          {footer}
        </div>
      )}
    </Card>
  )
}

/** One row inside a `flush` panel. Hairlines between, never after the last. */
export function ModuleRow({
  children,
  className,
  ...rest
}: ComponentPropsWithoutRef<'div'> & { children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-3 px-5 py-3 not-last:border-b not-last:border-edge-faint',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

/**
 * The scrolling filter row a module puts above its content. Horizontal on a
 * phone, so eight filters do not become four lines of chips.
 */
export function FilterRow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'scrollbar-none -mx-1 flex items-center gap-2 overflow-x-auto px-1 py-0.5',
        className,
      )}
    >
      {children}
    </div>
  )
}
