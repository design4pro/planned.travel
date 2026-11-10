import { cn } from '#/lib/cn'

import type { ReactNode } from 'react'

/** One mounted tree; CSS applies the stored composition before hydration. */
export function DashboardLayout({
  hero,
  stats,
  controls,
  trips,
  widgets,
}: {
  hero: ReactNode
  stats: ReactNode
  controls: ReactNode
  trips: ReactNode
  widgets?: ReactNode
}) {
  return (
    <div
      className="dashboard-layout"
      data-has-widgets={widgets ? '' : undefined}
    >
      <div className="dashboard-main">
        <div className="dashboard-hero min-w-0">{hero}</div>
        <div className="dashboard-stats min-w-0">{stats}</div>
        <div className="dashboard-controls min-w-0">{controls}</div>
        {/* Keep the former nested grid's smaller gap on stacked tablets. */}
        <div
          className={cn(
            'dashboard-trips min-w-0',
            widgets && 'lg:max-xl:-mt-2',
          )}
        >
          {trips}
        </div>
      </div>
      {widgets ? <div className="dashboard-rail min-w-0">{widgets}</div> : null}
    </div>
  )
}
