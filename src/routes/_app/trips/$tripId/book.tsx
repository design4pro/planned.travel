import { useEffect, useState } from 'react'
import { createFileRoute, useRouteContext } from '@tanstack/react-router'
import { CalendarClock, Ticket } from 'lucide-react'
import { z } from 'zod'

import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import {
  BookingsTimeline,
  ImportBookingsAction,
  ImportBookingsDialog,
  NewBookingAction,
  bookImportsOwner,
} from '#/components/modules/book'
import { Alert, Card, ProgressRing, StatCard } from '#/components/ui'
import { useLocale, useTranslate } from '#/lib/i18n'
import { loadBookingDeskFn } from '#/server/fns/reservations'
import { loadDisplayPreferences } from '../../-server/settings'
import { formatMoneyMinor, formatNumber } from '../../-lib/format'
import { HeaderSkeleton, RowsSkeleton, StatsSkeleton } from '../../-ui/scaffold'
import { TripModuleHeader } from '../../-ui/trip-header'

export const Route = createFileRoute('/_app/trips/$tripId/book')({
  /*
   * `?import=<jobId>` is how the global widget's Review lands on the desk with the review list
   * already open. A search parameter rather than client state, because the widget is mounted in
   * the shell and the dialog is on this route: a link is the only thing they both understand, and
   * it survives a reload the way the register it names does.
   */
  validateSearch: z.object({
    import: z.string().trim().min(1).max(128).optional(),
  }),
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
  // The signed-in user and workspace come off the shell's route context rather than a second
  // request: the import register in `localStorage` is keyed by them.
  const { shell } = useRouteContext({ from: '/_app' })
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [newBookingOpen, setNewBookingOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(
    search.import !== undefined && data.canWrite,
  )

  // The parameter is an instruction, not state: it opens the dialog once and is then dropped, so
  // closing the dialog and reopening it is not fought by a URL that still says "open".
  useEffect(() => {
    if (search.import === undefined) {
      return
    }
    // A reader who may not write is refused at the server; the dialog is simply not offered.
    setImportOpen(data.canWrite)
    void navigate({ search: {}, replace: true })
  }, [data.canWrite, navigate, search.import])

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
          actions={
            data.canWrite ? (
              <>
                <ImportBookingsAction onClick={() => setImportOpen(true)} />
                <NewBookingAction onClick={() => setNewBookingOpen(true)} />
              </>
            ) : null
          }
        />

        {data.archived ? (
          <Alert tone="info" size="sm">
            {t('trips.book.readOnly.archived')}
          </Alert>
        ) : null}

        {data.canWrite ? (
          <ImportBookingsDialog
            tripId={tripId}
            userId={bookImportsOwner(
              shell.session.user.id,
              shell.session.organization?.id ?? null,
            )}
            open={importOpen}
            onOpenChange={setImportOpen}
          />
        ) : null}

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
          canWrite={data.canWrite}
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
