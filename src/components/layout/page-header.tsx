import { cn } from '#/lib/cn'
import { Panel, SectionLabel } from './kit'

import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  description?: string
  /** Tiny tracked line above the title — the module or breadcrumb context. */
  eyebrow?: string
  actions?: ReactNode
  /** Extra content below the title row: filters, counters, tabs. */
  children?: ReactNode
  /**
   * `band` sits the header inside a card, the way the reference does; `plain`
   * lets a page open straight onto its own content.
   */
  variant?: 'band' | 'plain'
  className?: string
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  children,
  variant = 'band',
  className,
}: PageHeaderProps) {
  const heading = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
      <div className="min-w-0">
        {eyebrow ? <SectionLabel className="mb-1.5">{eyebrow}</SectionLabel> : null}
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-4">
          <h1 className="font-display text-title text-ink">{title}</h1>
          {description ? (
            <>
              <span aria-hidden className="hidden h-4 w-px shrink-0 self-center bg-edge sm:block" />
              <p className="text-label text-ink-3">{description}</p>
            </>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:ms-auto">{actions}</div>
      ) : null}
    </div>
  )

  if (variant === 'plain') {
    return (
      <div className={cn('flex flex-col gap-5', className)}>
        {heading}
        {children}
      </div>
    )
  }

  return (
    <Panel className={cn('flex flex-col gap-5 px-5 py-4 sm:px-6 sm:py-5', className)}>
      {heading}
      {children}
    </Panel>
  )
}

/** Panel-level heading: the tracked label plus an optional trailing control. */
export function PanelHeader({
  label,
  count,
  action,
  className,
}: {
  label: string
  count?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <div className="flex items-baseline gap-2">
        <SectionLabel>{label}</SectionLabel>
        {count ? <span className="numeral text-caption text-ink-4">{count}</span> : null}
      </div>
      {action}
    </div>
  )
}
