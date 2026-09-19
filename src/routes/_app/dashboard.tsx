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
import { formatStorageSize } from '#/components/layout/storage-size'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Progress,
  Separator,
  Skeleton,
  StatCard,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import { useI18n, useTranslate } from '#/lib/i18n'
import { loadDashboard } from './-server/overview'
import {
  countryFlag,
  daysBetween,
  daysUntil,
  formatDateRange,
  formatNumber,
  formatPercent,
  formatTimeRange,
  formatWeekday,
} from './-lib/format'
import { RESERVATION_STATUS_TONE, TRIP_STATUS_TONE, toneFor } from './-lib/tone'
import {
  DashboardWidgetsColumn,
  DashboardWidgetsMenu,
  DashboardWidgetsSheet,
  useDashboardWidgets,
  useWidgetsInSheet,
} from './-ui/dashboard-widgets'
import {
  HeaderSkeleton,
  Panel,
  PanelRow,
  RowsSkeleton,
  StatsSkeleton,
} from './-ui/scaffold'
import { TimezoneClock } from './-ui/timezone-clock'
import { TripGrid } from './-ui/trip-card'

import type { ReactNode } from 'react'
import type { DashboardWidgetId } from '#/lib/clock-zones'
import type { Locale, MessageKey, Translate } from '#/lib/i18n'
import type {
  DashboardPayload,
  ReservationCard,
  TripCard,
} from './-server/overview'

/** Every country on the map, so "of 195" is a formatted figure and not a word. */
const COUNTRIES_IN_THE_WORLD = 195

/**
 * A status column is a token, but a status badge is prose. The three closed
 * enumerations this screen shows get one key each; anything a future migration
 * adds falls through to the raw token, which is a data value a reader can report
 * rather than an English sentence pretending to be copy.
 */
const TRIP_STATUS_LABEL: Record<string, MessageKey | undefined> = {
  draft: 'shell.tripStatus.draft',
  planning: 'shell.tripStatus.planning',
  booked: 'shell.tripStatus.booked',
  active: 'shell.tripStatus.active',
  completed: 'shell.tripStatus.completed',
  archived: 'shell.tripStatus.archived',
}

const BOOKING_STATUS_LABEL: Record<string, MessageKey | undefined> = {
  none: 'shell.bookingStatus.none',
  pending: 'shell.bookingStatus.pending',
  confirmed: 'shell.bookingStatus.confirmed',
  cancelled: 'shell.bookingStatus.cancelled',
  completed: 'shell.bookingStatus.completed',
}

const BOOKING_TYPE_LABEL: Record<string, MessageKey | undefined> = {
  accommodation: 'shell.bookingType.accommodation',
  restaurant: 'shell.bookingType.restaurant',
  activity: 'shell.bookingType.activity',
  tour: 'shell.bookingType.tour',
  ticket: 'shell.bookingType.ticket',
  transport: 'shell.bookingType.transport',
  other: 'shell.bookingType.other',
}

function labelFor(
  table: Record<string, MessageKey | undefined>,
  token: string,
  t: Translate,
): string {
  const key = table[token]
  return key === undefined ? token : t(key)
}

export const Route = createFileRoute('/_app/dashboard')({
  loader: () => loadDashboard(),
  pendingComponent: DashboardPending,
  errorComponent: DashboardError,
  component: DashboardPage,
})

function DashboardError({ error }: { error: unknown }) {
  const t = useTranslate()
  return (
    <AppFrame>
      <ErrorPanel error={error} title={t('shell.dashboard.error')} />
    </AppFrame>
  )
}

function DashboardPage() {
  const data = Route.useLoaderData()
  const widgets = useDashboardWidgets()
  const inSheet = useWidgetsInSheet()

  /**
   * What each widget draws. Built as a table rather than as a chain of
   * conditions so the reference column's order lives in one place — the widget
   * list itself — and adding the deferred converter later is one row here.
   *
   * These are element *descriptions*; only the ones the reader kept, in the one
   * surface the breakpoint chose, are ever mounted.
   */
  const bodies: Record<DashboardWidgetId, ReactNode> = {
    clock: (
      <TimezoneClock
        zones={widgets.zones}
        onZonesChange={widgets.setZones}
        today={data.today}
      />
    ),
    bookings: <NextBookings reservations={data.reservations} />,
    tripMix: <TripMix data={data} />,
    storage: <StorageMeter data={data} />,
  }

  const shown = widgets.shown.map((id) => (
    <div key={id} data-part={`dashboard-widget-${id}`}>
      {bodies[id]}
    </div>
  ))

  return (
    <AppFrame>
      <AppSections>
        <UpNext data={data} />
        <StatRow data={data} />

        {/* The column's own controls, deliberately outside it: the menu can
            empty the column, and a control that went with the last widget would
            leave the reader no way of bringing anything back. */}
        <div className="flex min-h-9 flex-wrap items-center justify-end gap-2">
          <DashboardWidgetsMenu widgets={widgets} />
          {inSheet && shown.length > 0 ? (
            <DashboardWidgetsSheet>{shown}</DashboardWidgetsSheet>
          ) : null}
        </div>

        <div
          className={cn(
            'grid gap-6',
            // Every widget switched off collapses the column outright rather
            // than leaving an empty rail beside the content — the failure mode a
            // per-widget `display: none` produces.
            shown.length > 0 && 'xl:grid-cols-[minmax(0,1fr)_21rem] xl:gap-8',
          )}
        >
          <div className="flex min-w-0 flex-col gap-6">
            <YourTrips data={data} />
          </div>
          {inSheet || shown.length === 0 ? null : (
            <DashboardWidgetsColumn>{shown}</DashboardWidgetsColumn>
          )}
        </div>
      </AppSections>
    </AppFrame>
  )
}

/* ----------------------------------------------------------------- up next */

function UpNext({ data }: { data: DashboardPayload }) {
  const { t, locale } = useI18n()
  const trip = data.upNext

  if (trip === null) {
    return (
      /* The designed nothing sits on `--color-surface-2` rather than on the bare
         canvas, so the invitation reads as a place on the page in both themes
         instead of a dashed outline around the background. */
      <Card variant="dashed" padding="none" className="bg-surface-2">
        <EmptyState
          size="lg"
          tone="brand"
          icon={<Compass />}
          /* With no trips yet this invitation *is* the page, so it carries the
             `h1` the hero carries once there is a trip to name. */
          titleAs="h1"
          title={t('shell.dashboard.blank.title')}
          description={t('shell.dashboard.blank.body')}
          action={
            <Button asChild variant="primary" shape="pill" size="lg">
              <Link to="/trips">
                <Plus aria-hidden strokeWidth={2.5} />
                {t('shell.dashboard.blank.action')}
              </Link>
            </Button>
          }
          secondaryAction={
            <Button asChild variant="ghost" shape="pill" size="lg">
              <Link to="/atlas">{t('shell.dashboard.blank.secondary')}</Link>
            </Button>
          }
        />
      </Card>
    )
  }

  const startsIn = daysUntil(trip.startDate, data.today)
  const length = daysBetween(trip.startDate, trip.endDate)
  const nights = length === null ? null : Math.max(length - 1, 0)
  const range = formatDateRange(trip.startDate, trip.endDate, locale)
  /*
   * Only while the trip is under way: a percentage on a trip that has not started is noise, and
   * on one that has ended it is a full bar saying nothing. The fraction itself is the server's,
   * computed from its own date, so this reads no clock either.
   */
  const endsIn = daysUntil(trip.endDate, data.today)
  const underWay =
    data.elapsed !== null && data.elapsed > 0 && endsIn !== null && endsIn >= 0

  return (
    <Card
      variant="inverse"
      padding="none"
      className="relative isolate overflow-hidden"
    >
      {trip.coverImageUrl === null ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-32 -end-24 size-80 rounded-full bg-brand/30 blur-3xl"
        />
      ) : (
        <>
          <img
            src={trip.coverImageUrl}
            alt=""
            // The hero, so deliberately not lazy — and told so, because the
            // trip cards below carry covers of their own and would otherwise
            // be fetched at the same weight as the thing being waited for.
            fetchPriority="high"
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
              {t('shell.dashboard.upNext')}
            </Badge>
            <Badge tone={toneFor(TRIP_STATUS_TONE, trip.status)} size="sm">
              {labelFor(TRIP_STATUS_LABEL, trip.status, t)}
            </Badge>
            {trip.countryCodes.length > 0 ? (
              <span aria-hidden className="text-label">
                {trip.countryCodes.slice(0, 4).map(countryFlag).join(' ')}
              </span>
            ) : null}
          </div>

          <Button asChild variant="inverse" shape="pill" size="sm">
            <Link to="/trips/$tripId/plan" params={{ tripId: trip.id }}>
              {t('shell.dashboard.openPlan')}
              {/* "Onward" is a reading direction, so the arrow turns round in `ar`. */}
              <ArrowUpRight aria-hidden data-mirror-rtl />
            </Link>
          </Button>
        </div>

        <div className="min-w-0">
          {/* The one place on the product that is allowed to shout. A trip name
              is short, so the ceiling is set where a two-word title still fills
              the slab rather than sitting politely inside it.

              It is the page's `h1` because it is the page's subject: this screen
              has no title bar by design, so the outline would otherwise open at
              `h2` and never name what the reader is looking at. `journey/$journeyId`
              already reads this way. */}
          <h1 className="font-display text-[clamp(2.25rem,7.5vw,5.5rem)] leading-[0.9] font-extrabold tracking-tighter text-balance text-inverse-on">
            {trip.title}
          </h1>
          {trip.destination === null ? null : (
            <p className="mt-4 text-subtitle text-inverse-muted">
              {trip.destination}
            </p>
          )}
        </div>

        {underWay ? (
          <Progress
            data-part="hero-progress"
            value={Math.round(data.elapsed * 100)}
            size="sm"
            tone="brand"
            label={
              <span className="text-inverse-muted">
                {t('shell.dashboard.hero.progress')}
              </span>
            }
            // The primitive's own value text is drawn in the light-surface ink,
            // which disappears on the inverse card; the same figure in the
            // card's muted ink instead.
            valueText={
              <span className="text-inverse-muted">
                {formatPercent(data.elapsed, locale)}
              </span>
            }
            className="bg-inverse-edge"
          />
        ) : null}

        {/* The three figures the trip is made of — nights, places, the people going — beside the
            countdown the card already carried. The trip's own people, not the workspace's: the
            strip is about this trip and nothing else. */}
        <dl
          data-part="hero-strip"
          className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-inverse-edge sm:grid-cols-4"
        >
          <HeroStat
            label={
              startsIn !== null && startsIn < 0
                ? t('shell.dashboard.hero.started')
                : t('shell.dashboard.hero.startsIn')
            }
            value={startsInValue(startsIn, locale, t)}
            hint={startsInHint(startsIn, t)}
          />
          <HeroStat
            label={t('shell.dashboard.hero.nights')}
            value={nights === null ? '—' : formatNumber(nights, locale)}
            hint={range ?? t('shell.dashboard.hero.datesMissing')}
          />
          <HeroStat
            label={t('shell.dashboard.hero.places')}
            value={formatNumber(trip.placeCount, locale)}
            hint={
              trip.placeCount === 0
                ? t('shell.dashboard.hero.placesNone')
                : t('shell.dashboard.hero.placesHint')
            }
          />
          <HeroStat
            label={t('shell.dashboard.hero.travellers')}
            value={formatNumber(trip.peopleCount, locale)}
            hint={t('shell.dashboard.hero.companionsHint')}
          />
        </dl>
      </div>
    </Card>
  )
}

/** An em dash for "no date", `Today` for the day itself, otherwise the figure. */
function startsInValue(
  startsIn: number | null,
  locale: Locale,
  t: Translate,
): string {
  if (startsIn === null) return '—'
  if (startsIn === 0) return t('shell.dashboard.hero.today')
  return formatNumber(Math.abs(startsIn), locale)
}

/**
 * The unit under the countdown, agreeing with the figure above it.
 *
 * `count` selects the CLDR branch and is never printed — the reader is looking
 * at the numeral in the same tile. The two keys used to be the bare words
 * `days ago` and `days`, which read as `Starts in / 1 / days` in English and
 * gave a translator of Polish or Arabic no branch to inflect.
 */
function startsInHint(startsIn: number | null, t: Translate): string {
  if (startsIn === null) return t('shell.dashboard.hero.startUnknown')
  if (startsIn === 0) return t('shell.dashboard.hero.startToday')
  const count = Math.abs(startsIn)
  return startsIn < 0
    ? t('shell.dashboard.hero.startPast', { count })
    : t('shell.dashboard.hero.startFuture', { count })
}

function HeroStat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="min-w-0 bg-inverse-surface px-4 py-4 text-center">
      <dt className="mb-2 truncate text-micro font-semibold tracking-label uppercase text-inverse-muted">
        {label}
      </dt>
      {/* No `data-numeric`. Every tile holds a grouped numeral, which is already
          an isolated run, and the countdown can hold the word `Today`, which is
          prose. `tabular-nums` is the part every tile actually wants, and it is a
          class rather than an attribute that also carries bidi meaning. */}
      <dd className="font-display text-display leading-none font-bold tracking-tighter tabular-nums text-inverse-on">
        {value}
      </dd>
      <p className="mt-1.5 truncate text-caption text-inverse-muted">{hint}</p>
    </div>
  )
}

/* --------------------------------------------------------------- stat row */

function StatRow({ data }: { data: DashboardPayload }) {
  const { t, locale } = useI18n()
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
        label={t('shell.dashboard.stat.countries')}
        value={formatNumber(data.atlas.countryCount, locale)}
        unit={t('shell.dashboard.stat.countriesUnit', {
          total: formatNumber(COUNTRIES_IN_THE_WORLD, locale),
        })}
        caption={
          // Caption and flags share one line rather than stacking. The extra row
          // set this tile's height, and because the four tiles are a single grid
          // row it opened a void under the numeral in the other three.
          <span className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate">
              {data.atlas.visitCount === 0
                ? t('shell.dashboard.stat.countriesNone')
                : t('shell.dashboard.stat.visits', {
                    count: data.atlas.visitCount,
                    visits: formatNumber(data.atlas.visitCount, locale),
                  })}
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
        label={t('shell.dashboard.stat.trips')}
        value={formatNumber(data.tripTotals.total, locale)}
        caption={t('shell.dashboard.stat.tripsCaption', {
          planning: formatNumber(planning, locale),
          booked: formatNumber(booked, locale),
        })}
      />
      <StatCard
        icon={<MapPin />}
        label={t('shell.dashboard.stat.places')}
        value={formatNumber(data.counts.places, locale)}
        caption={
          data.counts.places === 0
            ? t('shell.dashboard.stat.placesNone')
            : t('shell.dashboard.stat.placesAcross', {
                count: data.tripTotals.total,
                trips: formatNumber(data.tripTotals.total, locale),
              })
        }
      />
      <StatCard
        icon={<Ticket />}
        label={t('shell.dashboard.stat.bookings')}
        value={formatNumber(data.counts.reservations, locale)}
        caption={
          data.reservations.length === 0
            ? t('shell.dashboard.stat.bookingsNone')
            : t('shell.dashboard.stat.bookingsSoon', {
                count: data.reservations.length,
                bookings: formatNumber(data.reservations.length, locale),
              })
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------- your trips */

function YourTrips({ data }: { data: DashboardPayload }) {
  const { t, locale } = useI18n()
  const trips: Array<TripCard> = [
    ...data.mine,
    ...data.upcoming.filter(
      (trip) => !data.mine.some((mine) => mine.id === trip.id),
    ),
  ]

  return (
    <Panel
      label={t('shell.dashboard.trips.label')}
      count={
        trips.length === 0 ? undefined : formatNumber(trips.length, locale)
      }
      action={
        <Button asChild variant="ghost" size="sm" shape="pill">
          <Link to="/trips">
            {t('shell.dashboard.trips.all')}
            <ArrowUpRight aria-hidden data-mirror-rtl />
          </Link>
        </Button>
      }
    >
      {trips.length === 0 ? (
        <EmptyState
          variant="plain"
          size="sm"
          icon={<Compass />}
          title={t('shell.dashboard.trips.empty.title')}
          description={t('shell.dashboard.trips.empty.body')}
          action={
            <Button asChild variant="secondary" shape="pill" size="sm">
              <Link to="/trips">{t('shell.dashboard.trips.empty.action')}</Link>
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
  const { t, locale } = useI18n()

  return (
    <Panel
      label={t('shell.dashboard.bookings.label')}
      count={
        reservations.length === 0
          ? undefined
          : formatNumber(reservations.length, locale)
      }
      flush
    >
      {reservations.length === 0 ? (
        <div className="px-5 py-8">
          <EmptyState
            size="sm"
            icon={<Ticket />}
            title={t('shell.dashboard.bookings.empty.title')}
            description={t('shell.dashboard.bookings.empty.body')}
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
                    formatWeekday(row.startDate, locale),
                    formatTimeRange(row.startTime, row.endTime, locale),
                  ]
                    .filter((part) => part !== null)
                    .join(' · ') || labelFor(BOOKING_TYPE_LABEL, row.type, t)}
                </p>
              </div>
              <Badge
                tone={toneFor(RESERVATION_STATUS_TONE, row.status)}
                size="sm"
              >
                {labelFor(BOOKING_STATUS_LABEL, row.status, t)}
              </Badge>
            </PanelRow>
          ))}
        </div>
      )}
    </Panel>
  )
}

function TripMix({ data }: { data: DashboardPayload }) {
  const { t, locale } = useI18n()
  const total = Math.max(
    data.tripTotals.byStatus.reduce((sum, row) => sum + row.value, 0),
    1,
  )
  const rows = data.tripTotals.byStatus.filter((row) => row.value > 0)

  return (
    <Panel
      label={t('shell.dashboard.pipeline.label')}
      count={formatNumber(data.tripTotals.total, locale)}
    >
      {rows.length === 0 ? (
        <p className="text-label text-ink-3">
          {t('shell.dashboard.pipeline.empty')}
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
                label={labelFor(TRIP_STATUS_LABEL, row.status, t)}
                valueText={formatNumber(row.value, locale)}
              />
            </li>
          ))}
        </ul>
      )}
      <Separator className="my-4" />
      {/* `flex-wrap`, because these two phrases are the widest pair of
          translations in the rail. Measured at 360px in a locale whose
          catalogue has not landed yet: the un-wrapping row measured 383px of
          content in a 286px card and pushed the whole document sideways. A pair
          that does not fit now takes a second line instead — and in a locale
          that fits, nothing moves. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-caption text-ink-3">
        <span className="min-w-0">
          {t('shell.dashboard.pipeline.favourites', {
            count: data.tripTotals.favourites,
            favourites: formatNumber(data.tripTotals.favourites, locale),
          })}
        </span>
        <span className="min-w-0">
          {t('shell.dashboard.pipeline.archived', {
            count: data.tripTotals.archived,
            archived: formatNumber(data.tripTotals.archived, locale),
          })}
        </span>
      </div>
    </Panel>
  )
}

function StorageMeter({ data }: { data: DashboardPayload }) {
  const { t, locale } = useI18n()
  const used = data.storage.usedBytes
  const limit = Math.max(data.storage.limitBytes, 1)

  return (
    <Panel
      label={t('shell.dashboard.storage.label')}
      count={t('shell.dashboard.storage.count', {
        used: formatStorageSize(used, locale),
        limit: formatStorageSize(limit, locale),
      })}
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
            {t('shell.dashboard.storage.files', {
              count: data.counts.files,
              files: formatNumber(data.counts.files, locale),
            })}
          </p>
        </div>
      </div>
      <Separator className="my-4" />
      {/* Same wrap as the pipeline footer above, for the same measurement: a
          prompt and its link are a sentence's worth of copy in a 286px card. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex min-w-0 items-center gap-2 text-caption text-ink-3">
          <Coins aria-hidden className="size-3.5 shrink-0" />
          {t('shell.dashboard.storage.more')}
        </span>
        <Button asChild variant="link" size="sm">
          <Link to="/settings/billing">
            {t('shell.dashboard.storage.plans')}
          </Link>
        </Button>
      </div>
    </Panel>
  )
}

/* --------------------------------------------------------------- skeleton */

/**
 * The loading state, sized to the layout it replaces so the page settles instead
 * of reflowing. The two list cards are `inset` — `--color-surface-2` — which is
 * how a reader tells "this region is still arriving" from "this region is a card
 * with nothing in it".
 */
function DashboardPending() {
  return (
    <AppFrame>
      <AppSections>
        <HeaderSkeleton />
        <StatsSkeleton />
        {/* The widget controls' own row, reserved at the height the live header
            occupies — `min-h-9` on a row of `sm` pills — so the grid below it
            starts where it will start once the payload lands. */}
        <div className="flex min-h-9 items-center justify-end">
          <Skeleton className="h-8 w-36 rounded-full" />
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] xl:gap-8">
          <Card variant="inset" padding="none">
            <RowsSkeleton rows={4} />
          </Card>
          {/* The reference column as it arrives by default: the clock, whose
              first row is the reader's own zone and whose footer is the picker,
              then the three panels beside it. One block for the whole column
              would settle by growing a widget's worth of height, which is the
              layout shift this state exists to avoid. The default is what is
              reserved, because the pending frame is rendered before anything can
              read the browser's preference without disagreeing with the server. */}
          <div className="flex min-w-0 flex-col gap-6">
            <Card variant="inset" padding="none">
              <RowsSkeleton rows={2} />
            </Card>
            <Card variant="inset" padding="none">
              <RowsSkeleton rows={3} />
            </Card>
          </div>
        </div>
      </AppSections>
    </AppFrame>
  )
}
