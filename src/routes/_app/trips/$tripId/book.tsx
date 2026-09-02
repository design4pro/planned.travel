import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { CalendarClock, Ticket } from 'lucide-react'

import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { BookingsTimeline, NewBookingAction } from '#/components/modules/book'
import { Card, ProgressRing, StatCard } from '#/components/ui'
import { useLocale, useTranslate } from '#/lib/i18n'
import { loadBookingDeskFn } from '#/server/fns/reservations'
import { formatMoneyMinor, formatNumber } from '../../-lib/format'
import { HeaderSkeleton, StatsSkeleton } from '../../-ui/scaffold'
import { TripModuleHeader } from '../../-ui/trip-header'

export const Route = createFileRoute('/_app/trips/$tripId/book')({
  loader: ({ params }) =>
    loadBookingDeskFn({ data: { tripId: params.tripId } }),
  pendingComponent: BookPending,
  errorComponent: BookError,
  component: BookPage,
})

function BookError({ error }: { error: Error }) {
  const t = useTranslate()

  return (
    <AppFrame>
      <ErrorPanel error={error} title={t('trips.error.book')} />
    </AppFrame>
  )
}

function BookPage() {
  const locale = useLocale()
  const t = useTranslate()
  const data = Route.useLoaderData()
  const { tripId } = Route.useParams()
  const [newBookingOpen, setNewBookingOpen] = useState(false)

  const countFor = (status: string): number =>
    data.byStatus.find((row) => row.status === status)?.value ?? 0

  const confirmed = countFor('confirmed')
  const total = data.bookings.length
  const percent = Math.round((confirmed / Math.max(total, 1)) * 100)

  return (
    <AppFrame>
      <AppSections>
        <TripModuleHeader
          title={t('trips.book.title')}
          description={
            total === 0
              ? t('trips.book.empty')
              : [
                  t('trips.book.count.bookings', {
                    count: total,
                    bookings: formatNumber(total, locale),
                  }),
                  t('trips.book.count.confirmed', {
                    count: confirmed,
                    confirmed: formatNumber(confirmed, locale),
                  }),
                ].join(' · ')
          }
          actions={<NewBookingAction onClick={() => setNewBookingOpen(true)} />}
        />

        {total === 0 ? null : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="flex items-center gap-5">
              <ProgressRing
                value={confirmed}
                max={Math.max(total, 1)}
                diameter={72}
                thickness={8}
                tone="success"
                label={t('trips.book.progressLabel', {
                  count: total,
                  confirmed: formatNumber(confirmed, locale),
                  total: formatNumber(total, locale),
                })}
              >
                <span className="font-display text-label font-bold tabular-nums text-ink">
                  {percent}%
                </span>
              </ProgressRing>
              <div className="min-w-0">
                <p className="text-micro font-semibold tracking-label text-ink-3 uppercase">
                  {t('trips.book.confirmed')}
                </p>
                <p className="font-display text-title font-bold tabular-nums text-ink">
                  {formatNumber(confirmed, locale)}
                  <span className="ms-1 text-subtitle font-medium text-ink-3">
                    {t('trips.book.ofTotal', {
                      total: formatNumber(total, locale),
                    })}
                  </span>
                </p>
              </div>
            </Card>
            <StatCard
              icon={<CalendarClock />}
              label={t('trips.book.awaiting')}
              value={countFor('pending')}
              caption={
                countFor('pending') === 0
                  ? t('trips.book.nothingHanging')
                  : t('trips.book.chase')
              }
            />
            <StatCard
              tone="inverse"
              label={t('trips.book.committed')}
              value={formatMoneyMinor(
                data.committedMinor,
                data.currency,
                locale,
              )}
              caption={t('trips.book.committedCaption')}
            />
            <StatCard
              icon={<Ticket />}
              label={t('trips.book.onItinerary')}
              value={
                data.bookings.filter((booking) => booking.dayId !== null).length
              }
              caption={t('trips.book.pinnedCaption')}
            />
          </div>
        )}

        <BookingsTimeline
          tripId={tripId}
          bookings={data.bookings}
          days={data.days}
          currency={data.currency}
          newBookingOpen={newBookingOpen}
          onNewBookingOpenChange={setNewBookingOpen}
        />
      </AppSections>
    </AppFrame>
  )
}

function BookPending() {
  return (
    <AppFrame>
      <AppSections>
        <HeaderSkeleton />
        <StatsSkeleton />
      </AppSections>
    </AppFrame>
  )
}
