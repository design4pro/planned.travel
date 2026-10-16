import { Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'

import { AppFrame } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { NotFoundPanel } from '#/components/layout/not-found'
import { TripSubNav } from '#/components/layout/trip-sub-nav'
import { Card, Skeleton } from '#/components/ui'
import { APP_HEADER_TOP_CLASS } from '#/lib/atlas/layout'
import { cn } from '#/lib/cn'
import { useTranslate } from '#/lib/i18n'
import { PlanReadinessBoundary } from './-ui/plan-readiness'
import { loadTripHeader } from '../../-server/trip'
import { HeaderSkeleton, RowsSkeleton } from '../../-ui/scaffold'

/**
 * One trip's workspace.
 *
 * The header read lives here rather than in each tab, so switching between Plan,
 * Costs and Collab never re-fetches the trip, its travellers or its day count —
 * the sub-navigation stays put and only the panel below it changes.
 */
export const Route = createFileRoute('/_app/trips/$tripId')({
  loader: ({ params }) => loadTripHeader({ data: { tripId: params.tripId } }),
  pendingComponent: TripPending,
  notFoundComponent: () => (
    <AppFrame>
      <NotFoundPanel />
    </AppFrame>
  ),
  errorComponent: TripError,
  component: TripLayout,
})

function TripError({ error }: { error: Error }) {
  const t = useTranslate()

  return (
    <AppFrame>
      <ErrorPanel error={error} title={t('trips.error.trip')} />
    </AppFrame>
  )
}

function TripLayout() {
  const { trip } = Route.useLoaderData()
  const planLoading = useRouterState({
    select: (state) => state.status === 'pending',
  })
  const planEntry = useRouterState({
    select: (state) =>
      state.location.pathname === `/trips/${trip.id}/plan`
        ? `${state.location.href}:${state.location.state.__TSR_key}`
        : null,
  })

  return (
    <>
      <TripSubNav tripId={trip.id} tripName={trip.title} />
      <PlanReadinessBoundary
        entryKey={planEntry}
        loaderReady={!planLoading}
        title={trip.title}
      >
        <Outlet />
      </PlanReadinessBoundary>
    </>
  )
}

function TripPending() {
  return (
    <>
      <div
        className={cn(
          // The same offset the real sub-navigation pins at, so the skeleton
          // does not move when the trip lands.
          'sticky z-nav border-b border-inverse-edge bg-inverse',
          APP_HEADER_TOP_CLASS,
        )}
      >
        <div className="mx-auto flex h-subnav max-w-content items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Skeleton
            className="h-6 w-16 shrink-0 bg-inverse-surface"
            radius="full"
          />
          <Skeleton
            className="h-6 w-40 shrink-0 bg-inverse-surface"
            radius="full"
          />
          <Skeleton
            className="ms-auto h-6 w-20 shrink-0 bg-inverse-surface"
            radius="full"
          />
        </div>
      </div>
      <AppFrame>
        <div className="flex flex-col gap-6 lg:gap-8">
          <HeaderSkeleton />
          <Card padding="none">
            <RowsSkeleton rows={5} />
          </Card>
        </div>
      </AppFrame>
    </>
  )
}
