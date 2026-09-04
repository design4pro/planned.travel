import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Route as RouteIcon } from 'lucide-react'

import { useLocale } from '#/lib/i18n'
import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import {
  ConnectionsBadge,
  TransportsTimeline,
  NewTransportAction,
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
  const locale = useLocale()
  const data = Route.useLoaderData()
  const { tripId } = Route.useParams()
  const [newTransportOpen, setNewTransportOpen] = useState(false)

  const busiest = [...data.byMode]
    .sort((left, right) => right.count - left.count)
    .at(0)
  const priced = data.transports.filter(
    (transport) => transport.priceMinor !== null,
  )
  const totalPriced = priced.reduce(
    (sum, transport) => sum + (transport.priceMinor ?? 0),
    0,
  )
  const summary = summariseConnections(analyseConnections(data.transports))

  return (
    <AppFrame>
      <AppSections>
        <TripModuleHeader
          title="Transports"
          description={
            data.transports.length === 0
              ? 'No transports recorded yet'
              : `${pluralise(data.transports.length, 'transport')} · ${formatDistance(data.totalDistanceMetres, data.distanceUnit)}`
          }
          actions={
            <NewTransportAction onClick={() => setNewTransportOpen(true)} />
          }
        >
          {summary.checked === 0 ? null : (
            <ConnectionsBadge
              impossible={summary.impossible}
              tight={summary.tight}
            />
          )}
        </TripModuleHeader>

        {data.transports.length === 0 ? null : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              tone="inverse"
              icon={<RouteIcon />}
              label="Distance travelled"
              value={formatNumber(
                Math.round(data.totalDistanceMetres / 1000),
                locale,
              )}
              unit="km"
              caption={`≈ ${(data.totalDistanceMetres / 40_075_000).toFixed(2)}× around the equator`}
            />
            <StatCard
              label="Transports"
              value={data.transports.length}
              caption={
                busiest === undefined
                  ? 'Nothing grouped yet'
                  : `mostly ${humaniseToken(busiest.mode).toLowerCase()}`
              }
            />
            <StatCard
              label="Confirmed"
              value={
                data.transports.filter(
                  (transport) => transport.status === 'confirmed',
                ).length
              }
              caption={`${formatNumber(data.transports.filter((transport) => transport.status === 'pending').length, locale)} still pending`}
            />
            <StatCard
              label="Spent on travel"
              value={formatMoneyMinor(totalPriced, data.currency, locale)}
              caption={
                priced.length === 0
                  ? 'No prices recorded'
                  : `across ${pluralise(priced.length, 'priced transport')}`
              }
            />
          </div>
        )}

        <TransportsTimeline
          tripId={tripId}
          transports={data.transports}
          currency={data.currency}
          newTransportOpen={newTransportOpen}
          onNewTransportOpenChange={setNewTransportOpen}
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
