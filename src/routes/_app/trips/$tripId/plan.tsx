import { createFileRoute } from '@tanstack/react-router'

import { AppFrame } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { GlassPanel, SectionLabel, Skeleton } from '#/components/ui'
import { loadPlanBoard } from './-server/plan'
import { PlanScreen } from './-ui/plan-screen'
import { useTripHeader } from '../../-ui/trip-header'

/**
 * The planner: the signature screen.
 *
 * Full-bleed on purpose. Every other tab in a trip renders into the standard content
 * well, and this one does not, because the map *is* the page — the question the screen
 * exists to answer is spatial, and framing a map inside a card answers it worse. So
 * the route is thin: it loads the board and hands the whole viewport slice to
 * `PlanScreen`, which floats the itinerary, the places and the filters over the map.
 */
export const Route = createFileRoute('/_app/trips/$tripId/plan')({
  loader: ({ params }) => loadPlanBoard({ data: { tripId: params.tripId } }),
  pendingComponent: PlanPending,
  errorComponent: ({ error }) => (
    <AppFrame>
      <ErrorPanel error={error} title="The plan did not load" />
    </AppFrame>
  ),
  component: PlanPage,
})

function PlanPage() {
  const payload = Route.useLoaderData()
  const { trip } = useTripHeader()

  return (
    <AppFrame bleed>
      <PlanScreen payload={payload} tripTitle={trip.title} />
    </AppFrame>
  )
}

/**
 * The loading state is the *layout*, not a spinner.
 *
 * A map screen that resolves into existence from a centred spinner reads as a page
 * that was not designed; two glass rails and a warm ground read as the planner
 * arriving. The proportions match the real thing exactly, so nothing moves when the
 * data lands.
 */
function PlanPending() {
  return (
    <AppFrame bleed>
      <div
        className={
          'relative isolate w-full overflow-hidden bg-surface-inset ' +
          'h-[calc(100svh-var(--safe-top)-var(--nav-h)-2.75rem-var(--subnav-h)-4rem-var(--safe-bottom))] ' +
          'lg:h-[calc(100svh-var(--safe-top)-var(--nav-h)-var(--subnav-h))]'
        }
      >
        <GlassPanel
          radius="full"
          padding="xs"
          className="absolute top-4 left-1/2 flex -translate-x-1/2 gap-1"
        >
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <Skeleton key={index} className="size-9" radius="full" />
          ))}
        </GlassPanel>

        <GlassPanel
          radius="xl"
          padding="none"
          className="absolute top-4 bottom-4 left-4 hidden w-86 flex-col overflow-hidden lg:flex"
        >
          <div className="border-b border-glass-edge px-3 py-2.5">
            <SectionLabel as="h2">Itinerary</SectionLabel>
          </div>
          <div className="flex flex-col gap-3 px-3 py-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <div key={index} className="flex items-center gap-2.5">
                <Skeleton className="size-11" radius="md" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel
          radius="xl"
          padding="none"
          className="absolute top-4 right-4 bottom-4 hidden w-82 flex-col overflow-hidden lg:flex"
        >
          <div className="border-b border-glass-edge px-3 py-2.5">
            <SectionLabel as="h2">Places</SectionLabel>
          </div>
          <div className="px-3 py-3">
            <Skeleton className="h-8 w-full" radius="md" />
          </div>
          <div className="flex flex-col gap-3 px-3">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="flex items-center gap-2.5">
                <Skeleton className="size-11" radius="md" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
    </AppFrame>
  )
}
