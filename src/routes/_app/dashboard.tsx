import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowUpRight,
  CalendarDays,
  Coins,
  Compass,
  Globe,
  HardDrive,
  MapPin,
  Plus,
  Ticket,
} from 'lucide-react'

import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Progress,
  Separator,
  StatCard,
} from '#/components/ui'
import { formatStorage } from '#/lib/plans'
import { loadDashboard } from './-server/overview'
import {
  countryFlag,
  daysBetween,
  daysUntil,
  formatDateRange,
  formatNumber,
  formatTimeRange,
  formatWeekday,
  humaniseToken,
  pluralise,
} from './-lib/format'
import { RESERVATION_STATUS_TONE, TRIP_STATUS_TONE, toneFor } from './-lib/tone'
import {
  HeaderSkeleton,
  Panel,
  PanelRow,
  RowsSkeleton,
  StatsSkeleton,
} from './-ui/scaffold'
import { TripGrid } from './-ui/trip-card'

import type {
  DashboardPayload,
  ReservationCard,
  TripCard,
} from './-server/overview'

export const Route = createFileRoute('/_app/dashboard')({
  loader: () => loadDashboard(),
  pendingComponent: DashboardPending,
  errorComponent: ({ error }) => (
    <AppFrame>
      <ErrorPanel error={error} title="The dashboard did not load" />
    </AppFrame>
  ),
  component: DashboardPage,
})

function DashboardPage() {
  const data = Route.useLoaderData()

  return (
    <AppFrame>
      <AppSections>
        <UpNext data={data} />
        <StatRow data={data} />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] xl:gap-8">
          <div className="flex min-w-0 flex-col gap-6">
            <YourTrips data={data} />
          </div>
          <aside className="flex min-w-0 flex-col gap-6">
            <NextBookings reservations={data.reservations} />
            <TripMix data={data} />
            <StorageMeter data={data} />
          </aside>
        </div>
      </AppSections>
    </AppFrame>
  )
}

/* ----------------------------------------------------------------- up next */

function UpNext({ data }: { data: DashboardPayload }) {
  const trip = data.upNext

  if (trip === null) {
    return (
      <Card variant="dashed" padding="none">
        <EmptyState
          size="lg"
          tone="brand"
          icon={<Compass />}
          title="Your next trip starts here"
          description="Create a trip, drop the places you want to see on the map, and planned.travel will build the day-by-day plan around them."
          action={
            <Button asChild variant="primary" shape="pill" size="lg">
              <Link to="/trips">
                <Plus aria-hidden strokeWidth={2.5} />
                Plan a trip
              </Link>
            </Button>
          }
          secondaryAction={
            <Button asChild variant="ghost" shape="pill" size="lg">
              <Link to="/atlas">See your atlas</Link>
            </Button>
          }
        />
      </Card>
    )
  }

  const startsIn = daysUntil(trip.startDate, data.today)
  const length = daysBetween(trip.startDate, trip.endDate)
  const range = formatDateRange(trip.startDate, trip.endDate)

  return (
    <Card
      variant="inverse"
      padding="none"
      className="relative isolate overflow-hidden"
    >
      {trip.coverImageUrl === null ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-24 size-80 rounded-full bg-brand/30 blur-3xl"
        />
      ) : (
        <>
          <img
            src={trip.coverImageUrl}
            alt=""
            className="absolute inset-0 -z-10 size-full object-cover opacity-40"
          />
          <span aria-hidden className="absolute inset-0 -z-10 bg-inverse/60" />
        </>
      )}

      <div className="relative flex flex-col gap-7 p-6 sm:gap-9 sm:p-8 lg:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone="inverse"
              size="sm"
              className="uppercase tracking-label"
            >
              Up next
            </Badge>
            <Badge tone={toneFor(TRIP_STATUS_TONE, trip.status)} size="sm">
              {humaniseToken(trip.status)}
            </Badge>
            {trip.countryCodes.length > 0 ? (
              <span aria-hidden className="text-label">
                {trip.countryCodes.slice(0, 4).map(countryFlag).join(' ')}
              </span>
            ) : null}
          </div>

          <Button asChild variant="inverse" shape="pill" size="sm">
            <Link to="/trips/$tripId/plan" params={{ tripId: trip.id }}>
              Open the plan
              <ArrowUpRight aria-hidden />
            </Link>
          </Button>
        </div>

        <div className="min-w-0">
          {/* The one place on the product that is allowed to shout. A trip name
              is short, so the ceiling is set where a two-word title still fills
              the slab rather than sitting politely inside it. */}
          <h2 className="font-display text-[clamp(2.25rem,7.5vw,5.5rem)] leading-[0.9] font-extrabold tracking-tighter text-balance text-inverse-on">
            {trip.title}
          </h2>
          {trip.destination === null ? null : (
            <p className="mt-4 text-subtitle text-inverse-muted">
              {trip.destination}
            </p>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-inverse-edge sm:grid-cols-4">
          <HeroStat
            label="Travellers"
            value={formatNumber(data.counts.members)}
            hint="in this workspace"
          />
          <HeroStat
            label="Trip dates"
            value={range ?? 'Not set'}
            hint={
              length === null
                ? 'Add dates to build days'
                : pluralise(length, 'day')
            }
            compact
          />
          <HeroStat
            label={startsIn !== null && startsIn < 0 ? 'Started' : 'Starts in'}
            value={
              startsIn === null
                ? '—'
                : startsIn === 0
                  ? 'Today'
                  : formatNumber(Math.abs(startsIn))
            }
            hint={
              startsIn === null
                ? 'no start date'
                : startsIn === 0
                  ? 'good luck out there'
                  : startsIn < 0
                    ? 'days ago'
                    : 'days'
            }
          />
          <HeroStat
            label="Places"
            value={formatNumber(trip.placeCount)}
            hint={trip.placeCount === 0 ? 'nothing mapped yet' : 'on the map'}
          />
        </dl>
      </div>
    </Card>
  )
}

function HeroStat({
  label,
  value,
  hint,
  compact = false,
}: {
  label: string
  value: string
  hint: string
  compact?: boolean
}) {
  return (
    <div className="min-w-0 bg-inverse-surface px-4 py-4 text-center">
      <dt className="mb-2 truncate text-micro font-semibold tracking-label uppercase text-inverse-muted">
        {label}
      </dt>
      <dd
        className={
          compact
            ? 'font-display text-label leading-tight font-bold tabular-nums text-inverse-on'
            : 'font-display text-[1.875rem] leading-none font-bold tracking-tighter tabular-nums text-inverse-on'
        }
      >
        {value}
      </dd>
      <p className="mt-1.5 truncate text-caption text-inverse-muted">{hint}</p>
    </div>
  )
}

/* --------------------------------------------------------------- stat row */

function StatRow({ data }: { data: DashboardPayload }) {
  const planning =
    data.tripTotals.byStatus.find((row) => row.status === 'planning')?.value ??
    0
  const booked =
    data.tripTotals.byStatus.find((row) => row.status === 'booked')?.value ?? 0

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        tone="inverse"
        icon={<Globe />}
        label="Countries visited"
        value={data.atlas.countryCount}
        unit="of 195"
        caption={
          // Caption and flags share one line rather than stacking. The extra row
          // set this tile's height, and because the four tiles are a single grid
          // row it opened a void under the numeral in the other three.
          <span className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate">
              {data.atlas.visitCount === 0
                ? 'Mark a country to start your atlas'
                : `${pluralise(data.atlas.visitCount, 'visit')} recorded`}
            </span>
            {data.atlas.countryCodes.length === 0 ? null : (
              <span aria-hidden className="shrink-0 text-label">
                {data.atlas.countryCodes.slice(0, 6).map(countryFlag).join(' ')}
              </span>
            )}
          </span>
        }
      />
      <StatCard
        icon={<CalendarDays />}
        label="Trips total"
        value={data.tripTotals.total}
        caption={`${formatNumber(planning)} planning · ${formatNumber(booked)} booked`}
      />
      <StatCard
        icon={<MapPin />}
        label="Places mapped"
        value={data.counts.places}
        caption={
          data.counts.places === 0
            ? 'Nothing on the map yet'
            : `across ${pluralise(data.tripTotals.total, 'trip')}`
        }
      />
      <StatCard
        icon={<Ticket />}
        label="Bookings confirmed"
        value={data.counts.reservations}
        caption={
          data.reservations.length === 0
            ? 'No bookings coming up'
            : `${pluralise(data.reservations.length, 'booking')} on the way`
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------- your trips */

function YourTrips({ data }: { data: DashboardPayload }) {
  const trips: Array<TripCard> = [
    ...data.mine,
    ...data.upcoming.filter(
      (trip) => !data.mine.some((mine) => mine.id === trip.id),
    ),
  ]

  return (
    <Panel
      label="Your trips"
      count={trips.length === 0 ? undefined : formatNumber(trips.length)}
      action={
        <Button asChild variant="ghost" size="sm" shape="pill">
          <Link to="/trips">
            All trips
            <ArrowUpRight aria-hidden />
          </Link>
        </Button>
      }
    >
      {trips.length === 0 ? (
        <EmptyState
          variant="plain"
          size="sm"
          icon={<Compass />}
          title="No trips yet"
          description="Everything you plan will show up here, newest first."
          action={
            <Button asChild variant="secondary" shape="pill" size="sm">
              <Link to="/trips">Create a trip</Link>
            </Button>
          }
        />
      ) : (
        <TripGrid trips={trips.slice(0, 6)} today={data.today} columns={2} />
      )}
    </Panel>
  )
}

/* ------------------------------------------------------------- right rail */

function NextBookings({
  reservations,
}: {
  reservations: ReadonlyArray<ReservationCard>
}) {
  return (
    <Panel
      label="Upcoming reservations"
      count={
        reservations.length === 0
          ? undefined
          : formatNumber(reservations.length)
      }
      flush
    >
      {reservations.length === 0 ? (
        <div className="px-5 py-8">
          <EmptyState
            size="sm"
            icon={<Ticket />}
            title="Nothing booked yet"
            description="Confirmed stays, tables and tickets appear here as their dates approach."
          />
        </div>
      ) : (
        <div>
          {reservations.map((row) => (
            <PanelRow key={row.id}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-3">
                <Ticket aria-hidden className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-label font-semibold text-ink">
                  {row.title}
                </p>
                <p className="truncate text-caption text-ink-3">
                  {[
                    formatWeekday(row.startDate),
                    formatTimeRange(row.startTime, row.endTime),
                  ]
                    .filter((part) => part !== null)
                    .join(' · ') || humaniseToken(row.type)}
                </p>
              </div>
              <Badge
                tone={toneFor(RESERVATION_STATUS_TONE, row.status)}
                size="sm"
              >
                {humaniseToken(row.status)}
              </Badge>
            </PanelRow>
          ))}
        </div>
      )}
    </Panel>
  )
}

function TripMix({ data }: { data: DashboardPayload }) {
  const total = Math.max(
    data.tripTotals.byStatus.reduce((sum, row) => sum + row.value, 0),
    1,
  )
  const rows = data.tripTotals.byStatus.filter((row) => row.value > 0)

  return (
    <Panel label="Trip pipeline" count={formatNumber(data.tripTotals.total)}>
      {rows.length === 0 ? (
        <p className="text-label text-ink-3">
          Nothing in the pipeline. Your first trip will break this down by
          stage.
        </p>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {rows.map((row) => (
            <li key={row.status}>
              <Progress
                value={row.value}
                max={total}
                size="sm"
                tone={row.status === 'active' ? 'success' : 'brand'}
                label={humaniseToken(row.status)}
                valueText={formatNumber(row.value)}
              />
            </li>
          ))}
        </ul>
      )}
      <Separator className="my-4" />
      <div className="flex items-center justify-between gap-3 text-caption text-ink-3">
        <span>{pluralise(data.tripTotals.favourites, 'favourite')}</span>
        <span>{pluralise(data.tripTotals.archived, 'archived trip')}</span>
      </div>
    </Panel>
  )
}

function StorageMeter({ data }: { data: DashboardPayload }) {
  const used = data.storage.usedBytes
  const limit = Math.max(data.storage.limitBytes, 1)

  return (
    <Panel
      label="Storage"
      count={`${formatStorage(used)} of ${formatStorage(limit)}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-3">
          <HardDrive aria-hidden className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <Progress
            value={used}
            max={limit}
            size="sm"
            tone={
              used / limit > 0.9
                ? 'danger'
                : used / limit > 0.7
                  ? 'warning'
                  : 'brand'
            }
          />
          <p className="text-caption text-ink-3">
            {pluralise(data.counts.files, 'file')} across every trip, including
            photos and tickets.
          </p>
        </div>
      </div>
      <Separator className="my-4" />
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-caption text-ink-3">
          <Coins aria-hidden className="size-3.5" />
          Need more room?
        </span>
        <Button asChild variant="link" size="sm">
          <Link to="/settings/billing">See plans</Link>
        </Button>
      </div>
    </Panel>
  )
}

/* --------------------------------------------------------------- skeleton */

function DashboardPending() {
  return (
    <AppFrame>
      <AppSections>
        <HeaderSkeleton />
        <StatsSkeleton />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] xl:gap-8">
          <Card padding="none">
            <RowsSkeleton rows={4} />
          </Card>
          <Card padding="none">
            <RowsSkeleton rows={3} />
          </Card>
        </div>
      </AppSections>
    </AppFrame>
  )
}
