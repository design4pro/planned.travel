import { Outlet, createFileRoute } from '@tanstack/react-router'

import { AppFrame } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { NotFoundPanel } from '#/components/layout/not-found'
import { TripSubNav } from '#/components/layout/trip-sub-nav'
import { Card, Skeleton } from '#/components/ui'
import { APP_HEADER_TOP_CLASS } from '#/lib/atlas/layout'
import { cn } from '#/lib/cn'
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
  errorComponent: ({ error }) => (
    <AppFrame>
      <ErrorPanel error={error} title="This trip did not load" />
    </AppFrame>
  ),
  component: TripLayout,
})

function TripLayout() {
  const { trip } = Route.useLoaderData()

  return (
    <>
      <TripSubNav tripId={trip.id} tripName={trip.title} />
      <Outlet />
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
            className="ml-auto h-6 w-20 shrink-0 bg-inverse-surface"
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
