import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Archive, Compass, Search, Star, X } from 'lucide-react'
import { z } from 'zod'

import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { PageHeader } from '#/components/layout/page-header'
import { Alert, Button, Card, EmptyState, Input } from '#/components/ui'
import { useLocale, useTranslate } from '#/lib/i18n'
import { loadTrips } from '../-server/overview'
import { formatNumber } from '../-lib/format'
import {
  CardsSkeleton,
  FilterBar,
  FilterCount,
  HeaderSkeleton,
  filterLinkClass,
} from '../-ui/scaffold'
import { TRIP_STATUS_LABEL } from '../-lib/tone'
import { NewTripDialog } from '../-ui/new-trip-dialog'
import { AddTile, TripGrid } from '../-ui/trip-card'

const TRIP_STATUSES = [
  'draft',
  'planning',
  'booked',
  'active',
  'completed',
] as const

const searchSchema = z.object({
  status: z.enum(TRIP_STATUSES).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  scope: z.enum(['all', 'favourites', 'archived']).optional(),
})

export const Route = createFileRoute('/_app/trips/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    loadTrips({
      data: {
        status: deps.status,
        search: deps.q,
        archived: deps.scope === 'archived' ? true : undefined,
        favourite: deps.scope === 'favourites' ? true : undefined,
      },
    }),
  pendingComponent: TripsPending,
  errorComponent: TripsError,
  component: TripsPage,
})

function TripsError({ error }: { error: unknown }) {
  const t = useTranslate()
  return (
    <AppFrame>
      <ErrorPanel error={error} title={t('shell.trips.error')} />
    </AppFrame>
  )
}

function TripsPage() {
  const locale = useLocale()
  const t = useTranslate()
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [query, setQuery] = useState(search.q ?? '')

  const scope = search.scope ?? 'all'
  const atLimit = data.tripLimit > 0 && data.totals.total >= data.tripLimit
  const countFor = (status: string): number =>
    data.totals.byStatus.find((row) => row.status === status)?.value ?? 0
  const unfiltered =
    search.q === undefined && search.status === undefined && scope === 'all'
  // "All" is the *unarchived* set, which is what this list shows unless the
  // archived scope is picked. Counting the archived trip in it made the pill
  // read "All 5" over four cards.
  const activeTotal = data.totals.total - data.totals.archived

  return (
    <AppFrame>
      <AppSections>
        <PageHeader
          eyebrow={t('shell.trips.eyebrow')}
          title={t('shell.nav.trips.short')}
          description={
            data.totals.total === 0
              ? t('shell.trips.nothingPlanned')
              : // Counts the same four trips the `All` pill counts, and says so when
                // one of them is archived — a header reading "5 trips" over four
                // cards and an "All 4" pill leaves the reader to guess which number
                // is the honest one.
                //
                // Three counted phrases joined by a separator rather than one
                // sentence with three numbers in it: a list survives translation,
                // and each noun gets the plural branch its own language needs.
                [
                  t('shell.trips.count.trips', {
                    count: activeTotal,
                    value: formatNumber(activeTotal, locale),
                  }),
                  ...(data.totals.archived > 0
                    ? [
                        t('shell.trips.count.archived', {
                          count: data.totals.archived,
                          value: formatNumber(data.totals.archived, locale),
                        }),
                      ]
                    : []),
                  t('shell.trips.count.favourites', {
                    count: data.totals.favourites,
                    value: formatNumber(data.totals.favourites, locale),
                  }),
                ].join(' · ')
          }
          actions={
            <>
              <Button asChild variant="secondary" shape="pill" size="sm">
                <Link to="/collections">{t('shell.trips.savedPlaces')}</Link>
              </Button>
              <NewTripDialog disabled={atLimit} />
            </>
          }
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <FilterBar>
              <Link
                to="/trips"
                search={{ q: search.q, scope: search.scope }}
                className={filterLinkClass(search.status === undefined)}
              >
                {t('shell.trips.filter.all')}
                <FilterCount>{formatNumber(activeTotal, locale)}</FilterCount>
              </Link>
              {TRIP_STATUSES.map((status) => (
                <Link
                  key={status}
                  to="/trips"
                  search={{ status, q: search.q, scope: search.scope }}
                  className={filterLinkClass(search.status === status)}
                >
                  {t(TRIP_STATUS_LABEL[status])}
                  <FilterCount>
                    {formatNumber(countFor(status), locale)}
                  </FilterCount>
                </Link>
              ))}
              <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-edge" />
              <Link
                to="/trips"
                search={{
                  status: search.status,
                  q: search.q,
                  scope: scope === 'favourites' ? undefined : 'favourites',
                }}
                className={filterLinkClass(scope === 'favourites')}
              >
                <Star aria-hidden className="size-3.5" />
                {t('shell.trips.filter.favourites')}
              </Link>
              <Link
                to="/trips"
                search={{
                  status: search.status,
                  q: search.q,
                  scope: scope === 'archived' ? undefined : 'archived',
                }}
                className={filterLinkClass(scope === 'archived')}
              >
                <Archive aria-hidden className="size-3.5" />
                {t('shell.tripStatus.archived')}
                <FilterCount>
                  {formatNumber(data.totals.archived, locale)}
                </FilterCount>
              </Link>
            </FilterBar>

            <form
              role="search"
              className="flex shrink-0 items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                const trimmed = query.trim()
                void navigate({
                  search: {
                    ...search,
                    q: trimmed === '' ? undefined : trimmed,
                  },
                })
              }}
            >
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('shell.trips.search')}
                aria-label={t('shell.trips.search')}
                leading={<Search />}
                className="lg:w-64"
              />
              {search.q === undefined ? null : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  shape="pill"
                  icon={<X />}
                  onClick={() => {
                    setQuery('')
                    void navigate({ search: { ...search, q: undefined } })
                  }}
                >
                  {t('ui.action.clear')}
                </Button>
              )}
            </form>
          </div>
        </PageHeader>

        {atLimit ? (
          <Alert
            tone="warning"
            title={t('shell.trips.atLimit.title')}
            actions={
              <Button asChild variant="secondary" size="sm" shape="pill">
                <Link to="/settings/billing">
                  {t('shell.trips.atLimit.action')}
                </Link>
              </Button>
            }
          >
            {t('shell.trips.atLimit.body', {
              trips: t('shell.trips.count.trips', {
                count: data.tripLimit,
                value: formatNumber(data.tripLimit, locale),
              }),
            })}
          </Alert>
        ) : null}

        {data.trips.length === 0 ? (
          <Card variant="dashed" padding="none">
            <EmptyState
              size="lg"
              tone="brand"
              icon={<Compass />}
              title={t(
                unfiltered
                  ? 'shell.dashboard.trips.empty.title'
                  : 'shell.trips.noMatch.title',
              )}
              description={t(
                unfiltered
                  ? 'shell.trips.empty.body'
                  : 'shell.trips.noMatch.body',
              )}
              action={
                unfiltered ? (
                  <NewTripDialog disabled={atLimit} size="md" />
                ) : (
                  <Button asChild variant="primary" shape="pill">
                    <Link to="/trips" search={{}}>
                      {t('shell.trips.noMatch.action')}
                    </Link>
                  </Button>
                )
              }
            />
          </Card>
        ) : (
          <TripGrid
            trips={data.trips}
            today={data.today}
            /* This grid is the page, under the page's own `h1`, so a trip is the
               second level here. On the dashboard the same grid sits inside a
               section that already has an `h2` and the tiles stay `h3`. */
            titleAs="h2"
            trailing={
              <AddTile
                icon={<Compass />}
                title={t('shell.trips.next.title')}
                description={t('shell.trips.next.body')}
                action={<NewTripDialog disabled={atLimit} size="md" />}
              />
            }
          />
        )}
      </AppSections>
    </AppFrame>
  )
}

function TripsPending() {
  return (
    <AppFrame>
      <AppSections>
        <HeaderSkeleton />
        <CardsSkeleton />
      </AppSections>
    </AppFrame>
  )
}
