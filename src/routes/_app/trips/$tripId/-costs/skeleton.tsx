/**
 * The costs screen's loading state.
 *
 * Shaped to the real layout rather than to a generic spinner: the tiles, the
 * toolbar, the two columns and the rail all reserve the room they will occupy, so
 * the page does not reflow when the data lands. That is the difference between a
 * skeleton and a placeholder.
 */
import { Card, Skeleton } from '#/components/ui'
import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { HeaderSkeleton, RowsSkeleton, StatsSkeleton } from '../../../-ui/scaffold'

export function CostsSkeleton() {
  return (
    <AppFrame>
      <AppSections>
        <HeaderSkeleton />
        <StatsSkeleton />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] xl:gap-8">
          <div className="flex min-w-0 flex-col gap-6">
            <Card aria-busy="true" className="flex flex-col gap-3.5">
              <span className="sr-only">Loading the expenses</span>
              <div className="flex items-baseline gap-3">
                <Skeleton className="h-5 w-28" radius="sm" />
                <Skeleton className="h-3 w-24" radius="sm" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-8 w-full max-w-72" radius="md" />
                <Skeleton className="ml-auto h-8 w-40" radius="md" />
                <Skeleton className="h-8 w-36" radius="md" />
                <Skeleton className="h-8 w-52" radius="full" />
              </div>
            </Card>
            <Card padding="none">
              <div className="px-5 pt-4 pb-3">
                <Skeleton className="h-3 w-24" radius="sm" />
              </div>
              <div className="border-t border-edge-faint">
                <RowsSkeleton rows={4} />
              </div>
            </Card>
            <Card padding="none">
              <div className="px-5 pt-4 pb-3">
                <Skeleton className="h-3 w-24" radius="sm" />
              </div>
              <div className="border-t border-edge-faint">
                <RowsSkeleton rows={3} />
              </div>
            </Card>
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            {[0, 1, 2].map((index) => (
              <Card key={index} className="flex flex-col gap-3.5">
                <Skeleton className="h-3 w-24" radius="sm" />
                {[0, 1, 2].map((line) => (
                  <div key={line} className="flex items-center gap-3">
                    <Skeleton className="size-6 shrink-0" radius="full" />
                    <Skeleton className="h-2.5 flex-1" radius="sm" />
                    <Skeleton className="h-2.5 w-14 shrink-0" radius="sm" />
                  </div>
                ))}
              </Card>
            ))}
          </div>
        </div>
      </AppSections>
    </AppFrame>
  )
}
