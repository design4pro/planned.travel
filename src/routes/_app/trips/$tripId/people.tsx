import { createFileRoute } from '@tanstack/react-router'

import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { Card } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { HeaderSkeleton, RowsSkeleton } from '../../-ui/scaffold'
import { PeopleScreen } from './-ui/people-screen'
import { loadTripPeople } from './-server/people'

/**
 * A route, not an eighth tab.
 *
 * `TRIP_TABS` stays at seven; this screen is reached from the sub-navigation's Share button, which
 * now leads here. The button's words do not change: the visibility switch lives on this page today
 * and link sharing joins it when `COL-10`/`COL-11` land, so "Share" stays honest.
 */
export const Route = createFileRoute('/_app/trips/$tripId/people')({
  loader: ({ params }) => loadTripPeople({ data: { tripId: params.tripId } }),
  pendingComponent: PeoplePending,
  errorComponent: PeopleError,
  component: PeoplePage,
})

function PeopleError({ error }: { error: Error }) {
  const t = useTranslate()

  return (
    <AppFrame>
      <ErrorPanel error={error} title={t('trips.error.people')} />
    </AppFrame>
  )
}

function PeoplePage() {
  const data = Route.useLoaderData()

  return (
    <AppFrame>
      <AppSections>
        <PeopleScreen data={data} />
      </AppSections>
    </AppFrame>
  )
}

function PeoplePending() {
  return (
    <AppFrame>
      <AppSections>
        <HeaderSkeleton />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
          <Card padding="none" className="lg:col-start-2 lg:row-start-1">
            <RowsSkeleton rows={3} />
          </Card>
          <Card padding="none" className="lg:col-start-1 lg:row-start-1">
            <RowsSkeleton rows={5} />
          </Card>
        </div>
      </AppSections>
    </AppFrame>
  )
}
