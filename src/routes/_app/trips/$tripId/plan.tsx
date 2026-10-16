import { createFileRoute } from '@tanstack/react-router'

import { AppFrame } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { GlassPanel, SectionLabel, Skeleton } from '#/components/ui'
import { TRIP_SLICE_HEIGHT_CLASS } from '#/lib/atlas/layout'
import { cn } from '#/lib/cn'
import { useTranslate } from '#/lib/i18n'
import { loadDayNotes } from './-server/day-notes'
import { loadPlanBoard } from './-server/plan'
import { loadPlanTransports } from './-server/plan-transports'
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
  // All three reads are indexed queries for the same trip in the same request, so a failure of one
  // is very nearly always a failure of all: `Promise.all` rejects and the route renders
  // `PlanError`, rather than growing a second loading contract for a partial board.
  loader: async ({ params }) => {
    const [board, notes, transports] = await Promise.all([
      loadPlanBoard({ data: { tripId: params.tripId } }),
      loadDayNotes({ data: { tripId: params.tripId } }),
      loadPlanTransports({ data: { tripId: params.tripId } }),
    ])
    return { board, notes, transports }
  },
  pendingMs: 0,
  pendingMinMs: 0,
  pendingComponent: PlanPending,
  errorComponent: PlanError,
  component: PlanPage,
})

function PlanError({ error }: { error: Error }) {
  const t = useTranslate()

  return (
    <AppFrame>
      <div data-plan-error="">
        <ErrorPanel error={error} title={t('trips.error.plan')} />
      </div>
    </AppFrame>
  )
}

function PlanPage() {
  const { board, notes, transports } = Route.useLoaderData()
  const { trip } = useTripHeader()

  return (
    <AppFrame bleed>
      <PlanScreen
        payload={board}
        notes={notes}
        transports={transports}
        tripTitle={trip.title}
      />
    </AppFrame>
  )
}

/**
 * Placeholder geometry while the board reads are pending. The trip-level readiness
 * boundary covers a slow read with the title; stored rail widths are restored by
 * the workspace before its loaded view is revealed.
 */
function PlanPending() {
  const t = useTranslate()

  return (
    <AppFrame bleed>
      <div
        className={cn(
          'relative isolate w-full overflow-hidden bg-surface-inset',
          // The same slice the real planner takes, from the one list that
          // measures the chrome above it — see `src/lib/atlas/layout.ts`.
          TRIP_SLICE_HEIGHT_CLASS.base,
          TRIP_SLICE_HEIGHT_CLASS.lg,
        )}
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
          className="absolute top-4 bottom-4 start-4 hidden w-86 flex-col overflow-hidden lg:flex"
        >
          <div className="border-b border-glass-edge px-3 py-2.5">
            <SectionLabel as="h2">{t('trips.plan.title')}</SectionLabel>
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
          className="absolute top-4 end-4 bottom-4 hidden w-82 flex-col overflow-hidden lg:flex"
        >
          <div className="border-b border-glass-edge px-3 py-2.5">
            <SectionLabel as="h2">{t('trips.plan.places')}</SectionLabel>
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
