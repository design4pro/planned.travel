import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Route as RouteIcon } from 'lucide-react'

import { useLocale } from '#/lib/i18n'
import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import {
  ConnectionsBadge,
  NewLegAction,
  TransportsTimeline,
  analyseConnections,
  summariseConnections,
} from '#/components/modules/transports'
import { Card, StatCard } from '#/components/ui'
import { loadTransportDeskFn } from '#/server/fns/transports'
import { loadDisplayPreferences } from '../../-server/settings'
import {
  formatDistance,
  formatMoneyMinor,
  formatNumber,
  humaniseToken,
  pluralise,
} from '../../-lib/format'
import { HeaderSkeleton, RowsSkeleton, StatsSkeleton } from '../../-ui/scaffold'
import { TripModuleHeader } from '../../-ui/trip-header'

export const Route = createFileRoute('/_app/trips/$tripId/transports')({
  /*
   * Two reads, one round trip. Without this the transport card's mask has no
   * channel at all: `TransportsTimeline` is a `components/modules` component, so
   * it never fetches, and neither `src/server/fns/transports.ts` nor
   * `src/routes/_app/-server/trip.ts` is free to carry the preference — so the
   * preference reaches this tab through the route or not at all.
   */
  loader: async ({ params }) => {
    const [desk, display] = await Promise.all([
      loadTransportDeskFn({ data: { tripId: params.tripId } }),
      loadDisplayPreferences(),
    ])
    return { ...desk, maskCodes: display.maskConfirmationCodes }
  },
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
  const [newLegOpen, setNewLegOpen] = useState(false)

  const busiest = [...data.byMode]
    .sort((left, right) => right.legs - left.legs)
    .at(0)
  const priced = data.transports.filter(
    (transport) => transport.priceMinor !== null,
  )
  const totalPriced = priced.reduce(
    (sum, transport) => sum + (transport.priceMinor ?? 0),
    0,
  )
  const confirmed = data.transports.filter(
    (transport) => transport.status === 'confirmed',
  ).length
  const pending = data.transports.filter(
    (transport) => transport.status === 'pending',
  ).length
  const summary = summariseConnections(analyseConnections(data.transports))

  return (
    <AppFrame>
      <AppSections>
        <TripModuleHeader
          title="Transports"
          description={
            data.transports.length === 0
              ? 'Nothing recorded yet'
              : `${pluralise(data.transports.length, 'transport')} · ${formatDistance(data.totalDistanceMetres, data.distanceUnit)}`
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
              value={confirmed}
              caption={`${formatNumber(pending, locale)} still pending`}
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
          days={data.days}
          currency={data.currency}
          maskCodes={data.maskCodes}
          newLegOpen={newLegOpen}
          onNewLegOpenChange={setNewLegOpen}
        />
      </AppSections>
    </AppFrame>
  )
}

/**
 * The header and the stats already settled while the list was still arriving, so
 * the list gets its own rows: without them the timeline pops in under a header
 * that has stopped moving, which reads as a layout shift rather than as a load.
 */
function TransportsPending() {
  return (
    <AppFrame>
      <AppSections>
        <HeaderSkeleton />
        <StatsSkeleton />
        <Card padding="none">
          <RowsSkeleton rows={5} />
        </Card>
      </AppSections>
    </AppFrame>
  )
}
