import { cn } from '#/lib/cn'
import { useTranslate } from '#/lib/i18n'
import { AppFrame } from './app-frame'
import { Panel, Skeleton, SkeletonLines } from './kit'

/**
 * What a module looks like while its data is in flight. The block sizes mirror
 * the real layouts, so the page settles into place instead of reflowing — zero
 * layout shift after paint is part of the contract.
 */
export function RouteFallback({ cards = 4, className }: { cards?: number; className?: string }) {
  const t = useTranslate()
  return (
    <AppFrame className={className}>
      <div aria-busy="true" aria-live="polite" className="flex flex-col gap-6 lg:gap-8">
        <span className="sr-only">{t('ui.status.loading')}</span>

        <Panel className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-52" />
          </div>
          <Skeleton className="h-10 w-32 rounded-full sm:ms-auto" />
        </Panel>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: cards }, (_, index) => (
            <Panel key={index} className="flex flex-col gap-4 p-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-11 w-24" />
              <SkeletonLines lines={2} />
            </Panel>
          ))}
        </div>
      </div>
    </AppFrame>
  )
}

/** Loading state for one panel inside an already-painted page. */
export function PanelFallback({ rows = 4, className }: { rows?: number; className?: string }) {
  const t = useTranslate()
  return (
    <div aria-busy="true" className={cn('flex flex-col gap-3.5', className)}>
      <span className="sr-only">{t('ui.status.loading')}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-2.5 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  )
}
