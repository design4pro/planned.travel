import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Archive, Compass, Search, Star, X } from 'lucide-react'
import { z } from 'zod'

import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { PageHeader } from '#/components/layout/page-header'
import { Alert, Button, Card, EmptyState, Input } from '#/components/ui'
import { loadTrips } from '../-server/overview'
import { formatNumber, humaniseToken, pluralise } from '../-lib/format'
import {
  CardsSkeleton,
  FilterBar,
  FilterCount,
  HeaderSkeleton,
  filterLinkClass,
} from '../-ui/scaffold'
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

/**
 * The favourites scope and its count are the **caller's own** bookmarks (PRD #104 decision 5):
 * `loadTrips` filters and counts through `trip_favourites` keyed by the acting user, so a colleague's
 * star never lands in this reader's shortlist. Nothing here reads the deprecated `trips.is_favourite`
 * column, which held one boolean for the whole trip and so recorded nobody's choice.
 */
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
  errorComponent: ({ error }) => (
    <AppFrame>
      <ErrorPanel error={error} title="Your trips did not load" />
    </AppFrame>
  ),
  component: TripsPage,
})

function TripsPage() {
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
          eyebrow="Workspace"
          title="Trips"
          description={
            data.totals.total === 0
              ? 'Nothing planned yet'
              : // Counts the same four trips the `All` pill counts, and says so when
                // one of them is archived — a header reading "5 trips" over four
                // cards and an "All 4" pill leaves the reader to guess which number
                // is the honest one.
                [
                  pluralise(activeTotal, 'trip'),
                  ...(data.totals.archived > 0
                    ? [`${formatNumber(data.totals.archived)} archived`]
                    : []),
                  // The favourites figure is the reader's own shortlist, so it
                  // is absent rather than "0 favourites" until they have made
                  // one — the same rule the archived clause already follows.
                  ...(data.totals.favourites > 0
                    ? [pluralise(data.totals.favourites, 'favourite')]
                    : []),
                ].join(' · ')
          }
          actions={
            <>
              <Button asChild variant="secondary" shape="pill" size="sm">
                <Link to="/collections">Saved places</Link>
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
                All
                <FilterCount>{formatNumber(activeTotal)}</FilterCount>
              </Link>
              {TRIP_STATUSES.map((status) => (
                <Link
                  key={status}
                  to="/trips"
                  search={{ status, q: search.q, scope: search.scope }}
                  className={filterLinkClass(search.status === status)}
                >
                  {humaniseToken(status)}
                  <FilterCount>{formatNumber(countFor(status))}</FilterCount>
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
                Favourites
                <FilterCount>
                  {formatNumber(data.totals.favourites)}
                </FilterCount>
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
                Archived
                <FilterCount>{formatNumber(data.totals.archived)}</FilterCount>
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
                placeholder="Search trips"
                aria-label="Search trips"
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
                  Clear
                </Button>
              )}
            </form>
          </div>
        </PageHeader>

        {atLimit ? (
          <Alert
            tone="warning"
            title="You have filled every trip your plan allows"
            actions={
              <Button asChild variant="secondary" size="sm" shape="pill">
                <Link to="/settings/billing">Compare plans</Link>
              </Button>
            }
          >
            {`Your plan covers ${pluralise(data.tripLimit, 'trip')}. Archive one you have finished, or move up a plan to keep more open at once.`}
          </Alert>
        ) : null}

        {data.trips.length === 0 ? (
          <Card variant="dashed" padding="none">
            <EmptyState
              size="lg"
              tone="brand"
              icon={<Compass />}
              title={
                unfiltered ? 'No trips yet' : 'Nothing matches that filter'
              }
              description={
                unfiltered
                  ? 'A trip holds your itinerary, your map, your bookings, your packing lists and the money. Start one and the rest follows.'
                  : 'Try a different stage, clear the search, or look in the archive.'
              }
              action={
                unfiltered ? (
                  <NewTripDialog disabled={atLimit} size="md" />
                ) : (
                  <Button asChild variant="primary" shape="pill">
                    <Link to="/trips" search={{}}>
                      Reset filters
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
            trailing={
              <AddTile
                icon={<Compass />}
                title="Somewhere next"
                description="Start a trip and planned.travel builds a day per date, ready for what you have saved."
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
