import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { CalendarClock, Ticket } from 'lucide-react'

import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { BookingsTimeline, NewBookingAction } from '#/components/modules/book'
import { Card, ProgressRing, StatCard } from '#/components/ui'
import { loadBookingDeskFn } from '#/server/fns/reservations'
import { loadDisplayPreferences } from '../../-server/settings'
import { formatMoneyMinor, formatNumber, pluralise } from '../../-lib/format'
import { HeaderSkeleton, RowsSkeleton, StatsSkeleton } from '../../-ui/scaffold'
import { TripModuleHeader } from '../../-ui/trip-header'

export const Route = createFileRoute('/_app/trips/$tripId/book')({
  /*
   * Two reads, one round trip. The reader's display preference is not part of
   * the desk payload — the transports tab needs the same boolean and a flag on
   * one desk payload would leave the other needing a second, differently shaped
   * copy of it — so it is fetched beside the desk rather than after it, and the
   * tab still settles in the time the slower of the two takes.
   */
  loader: async ({ params }) => {
    const [desk, display] = await Promise.all([
      loadBookingDeskFn({ data: { tripId: params.tripId } }),
      loadDisplayPreferences(),
    ])
    return { ...desk, maskCodes: display.maskConfirmationCodes }
  },
  pendingComponent: BookPending,
  errorComponent: ({ error }) => (
    <AppFrame>
      <ErrorPanel error={error} title="The bookings did not load" />
    </AppFrame>
  ),
  component: BookPage,
})

function BookPage() {
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
          title="Bookings"
          description={
            total === 0
              ? 'Nothing booked yet'
              : `${pluralise(total, 'booking')} · ${formatNumber(confirmed)} confirmed`
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
                label={`${confirmed} of ${total} bookings confirmed`}
              >
                <span className="font-display text-label font-bold tabular-nums text-ink">
                  {percent}%
                </span>
              </ProgressRing>
              <div className="min-w-0">
                <p className="text-micro font-semibold tracking-label text-ink-3 uppercase">
                  Confirmed
                </p>
                <p className="font-display text-title font-bold tabular-nums text-ink">
                  {formatNumber(confirmed)}
                  <span className="ml-1 text-subtitle font-medium text-ink-3">
                    of {total}
                  </span>
                </p>
              </div>
            </Card>
            <StatCard
              icon={<CalendarClock />}
              label="Awaiting confirmation"
              value={countFor('pending')}
              caption={
                countFor('pending') === 0
                  ? 'Nothing hanging'
                  : 'Chase these before you fly'
              }
            />
            <StatCard
              tone="inverse"
              label="Committed"
              value={formatMoneyMinor(data.committedMinor, data.currency)}
              caption="Across every booking on this trip"
            />
            <StatCard
              icon={<Ticket />}
              label="On the itinerary"
              value={
                data.bookings.filter((booking) => booking.dayId !== null).length
              }
              caption="Pinned to a day of the plan"
            />
          </div>
        )}

        <BookingsTimeline
          tripId={tripId}
          bookings={data.bookings}
          days={data.days}
          currency={data.currency}
          maskCodes={data.maskCodes}
          newBookingOpen={newBookingOpen}
          onNewBookingOpenChange={setNewBookingOpen}
        />
      </AppSections>
    </AppFrame>
  )
}

/**
 * The header and the stat tiles settled while the desk was still arriving, so the
 * desk gets its own rows: without them the two panels pop in under a header that
 * has stopped moving, which reads as a layout shift rather than as a load.
 */
function BookPending() {
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
