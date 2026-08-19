import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Route as RouteIcon } from 'lucide-react'

import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import {
  ConnectionsBadge,
  LegsTimeline,
  NewLegAction,
  analyseConnections,
  summariseConnections,
} from '#/components/modules/transports'
import { StatCard } from '#/components/ui'
import { loadTripTransports } from '../../-server/trip'
import {
  formatDistance,
  formatMoneyMinor,
  formatNumber,
  humaniseToken,
  pluralise,
} from '../../-lib/format'
import { HeaderSkeleton, StatsSkeleton } from '../../-ui/scaffold'
import { TripModuleHeader } from '../../-ui/trip-header'

export const Route = createFileRoute('/_app/trips/$tripId/transports')({
  loader: ({ params }) =>
    loadTripTransports({ data: { tripId: params.tripId } }),
  pendingComponent: TransportsPending,
  errorComponent: ({ error }) => (
    <AppFrame>
      <ErrorPanel error={error} title="The transports did not load" />
    </AppFrame>
  ),
  component: TransportsPage,
})

function TransportsPage() {
  const data = Route.useLoaderData()
  const { tripId } = Route.useParams()
  const [newLegOpen, setNewLegOpen] = useState(false)

  const busiest = [...data.byMode]
    .sort((left, right) => right.legs - left.legs)
    .at(0)
  const priced = data.legs.filter((leg) => leg.priceMinor !== null)
  const totalPriced = priced.reduce(
    (sum, leg) => sum + (leg.priceMinor ?? 0),
    0,
  )
  const summary = summariseConnections(analyseConnections(data.legs))

  return (
    <AppFrame>
      <AppSections>
        <TripModuleHeader
          title="Transports"
          description={
            data.legs.length === 0
              ? 'No legs recorded yet'
              : `${pluralise(data.legs.length, 'leg')} · ${formatDistance(data.totalDistanceMetres, data.distanceUnit)}`
          }
          actions={<NewLegAction onClick={() => setNewLegOpen(true)} />}
        >
          {summary.checked === 0 ? null : (
            <ConnectionsBadge
              impossible={summary.impossible}
              tight={summary.tight}
            />
          )}
        </TripModuleHeader>

        {data.legs.length === 0 ? null : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              tone="inverse"
              icon={<RouteIcon />}
              label="Distance travelled"
              value={formatNumber(Math.round(data.totalDistanceMetres / 1000))}
              unit="km"
              caption={`≈ ${(data.totalDistanceMetres / 40_075_000).toFixed(2)}× around the equator`}
            />
            <StatCard
              label="Legs"
              value={data.legs.length}
              caption={
                busiest === undefined
                  ? 'Nothing grouped yet'
                  : `mostly ${humaniseToken(busiest.mode).toLowerCase()}`
              }
            />
            <StatCard
              label="Confirmed"
              value={
                data.legs.filter((leg) => leg.status === 'confirmed').length
              }
              caption={`${formatNumber(data.legs.filter((leg) => leg.status === 'pending').length)} still pending`}
            />
            <StatCard
              label="Spent on travel"
              value={formatMoneyMinor(totalPriced, data.currency)}
              caption={
                priced.length === 0
                  ? 'No prices recorded'
                  : `across ${pluralise(priced.length, 'priced leg')}`
              }
            />
          </div>
        )}

        <LegsTimeline
          tripId={tripId}
          legs={data.legs}
          currency={data.currency}
          newLegOpen={newLegOpen}
          onNewLegOpenChange={setNewLegOpen}
        />
      </AppSections>
    </AppFrame>
  )
}

function TransportsPending() {
  return (
    <AppFrame>
      <AppSections>
        <HeaderSkeleton />
        <StatsSkeleton />
      </AppSections>
    </AppFrame>
  )
}
