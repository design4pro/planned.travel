import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Route as RouteIcon } from 'lucide-react'

import { useLocale, useTranslate } from '#/lib/i18n'
import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import {
  ConnectionsBadge,
  NewTransportAction,
  TransportsTimeline,
  analyseConnections,
  modeLabel,
  summariseConnections,
} from '#/components/modules/transports'
import { Card, StatCard } from '#/components/ui'
import { loadTransportDeskFn } from '#/server/fns/transports'
import { loadDisplayPreferences } from '../../-server/settings'
import {
  formatDistance,
  formatMoneyMinor,
  formatNumber,
} from '../../-lib/format'
import { HeaderSkeleton, RowsSkeleton, StatsSkeleton } from '../../-ui/scaffold'
import { TripModuleHeader } from '../../-ui/trip-header'

export const Route = createFileRoute('/_app/trips/$tripId/transports')({
  /*
   * Two reads, one round trip. Without this the transport card's mask has no
   * channel at all: `TransportsTimeline` does not read display preferences,
   * and neither `src/server/fns/transports.ts` nor
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
  errorComponent: TransportsError,
  component: TransportsPage,
})

function TransportsError({ error }: { error: Error }) {
  const t = useTranslate()

  return (
    <AppFrame>
      <ErrorPanel error={error} title={t('trips.error.transports')} />
    </AppFrame>
  )
}

function TransportsPage() {
  const locale = useLocale()
  const t = useTranslate()
  const data = Route.useLoaderData()
  const { tripId } = Route.useParams()
  const [newTransportOpen, setNewTransportOpen] = useState(false)
  const [writeBlocked, setWriteBlocked] = useState(false)
  useEffect(() => {
    setWriteBlocked(false)
  }, [data.canWrite, tripId])

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
          title={t('trips.transports.title')}
          description={
            data.transports.length === 0
              ? t('trips.transports.empty')
              : [
                  t('trips.transports.count.transports', {
                    count: data.transports.length,
                    transports: formatNumber(data.transports.length, locale),
                  }),
                  formatDistance(
                    data.totalDistanceMetres,
                    data.distanceUnit,
                    locale,
                  ),
                ].join(' · ')
          }
          actions={
            data.canWrite && !writeBlocked ? (
              <NewTransportAction onClick={() => setNewTransportOpen(true)} />
            ) : undefined
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
              label={t('trips.transports.distance')}
              value={formatNumber(
                Math.round(data.totalDistanceMetres / 1000),
                locale,
              )}
              unit="km"
              caption={t('trips.transports.equator', {
                times: (data.totalDistanceMetres / 40_075_000).toFixed(2),
              })}
            />
            <StatCard
              label={t('trips.transports.title')}
              value={data.transports.length}
              caption={
                busiest === undefined
                  ? t('trips.transports.noGrouping')
                  : t('trips.transports.mostly', {
                      mode: t(modeLabel(busiest.mode)),
                    })
              }
            />
            <StatCard
              label={t('trips.transports.confirmed')}
              value={confirmed}
              caption={t('trips.transports.stillPending', {
                count: pending,
                pending: formatNumber(pending, locale),
              })}
            />
            <StatCard
              label={t('trips.transports.spent')}
              value={formatMoneyMinor(totalPriced, data.currency, locale)}
              caption={
                priced.length === 0
                  ? t('trips.transports.noPrices')
                  : t('trips.transports.priced', {
                      count: priced.length,
                      priced: formatNumber(priced.length, locale),
                    })
              }
            />
          </div>
        )}

        <TransportsTimeline
          canWrite={data.canWrite}
          isArchived={data.isArchived}
          canSearchConnections={data.canWrite && data.canSearchConnections}
          tripId={tripId}
          transports={data.transports}
          days={data.days}
          currency={data.currency}
          maskCodes={data.maskCodes}
          newTransportOpen={newTransportOpen}
          onWriteBlockedChange={setWriteBlocked}
          onNewTransportOpenChange={setNewTransportOpen}
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
