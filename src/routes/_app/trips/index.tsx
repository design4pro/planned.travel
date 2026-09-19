import { useState } from 'react'
import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import {
  Archive,
  ChevronRight,
  Compass,
  LayoutGrid,
  List,
  Search,
  Star,
  X,
} from 'lucide-react'
import { z } from 'zod'

import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { PageHeader } from '#/components/layout/page-header'
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import { useLocale, useTranslate } from '#/lib/i18n'
import { useLocalPreference } from '#/lib/local-preference'
import { loadTrips } from '../-server/overview'
import { formatNumber } from '../-lib/format'
import {
  CardsSkeleton,
  FilterBar,
  FilterCount,
  HeaderSkeleton,
  RowsSkeleton,
  filterLinkClass,
} from '../-ui/scaffold'
import { TRIP_STATUS_LABEL } from '../-lib/tone'
import {
  DEFAULT_TRIP_VIEW,
  TRIPS_VIEW_PREFERENCE,
  TRIP_VIEW_MODES,
  withRememberedView,
} from '../-lib/view-mode'
import { NewTripDialog } from '../-ui/new-trip-dialog'
import { AddTile, TripGrid } from '../-ui/trip-card'
import { TripList } from '../-ui/trip-list-row'

import type { ReactNode } from 'react'
import type { MessageKey } from '#/lib/i18n'
import type { TripsPayload } from '../-server/overview'
import type { TripViewMode } from '../-lib/view-mode'

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
  view: z.enum(TRIP_VIEW_MODES).optional(),
})

const VIEW_OPTIONS: Record<
  TripViewMode,
  { readonly icon: ReactNode; readonly label: MessageKey }
> = {
  grid: { icon: <LayoutGrid />, label: 'shell.trips.view.grid' },
  list: { icon: <List />, label: 'shell.trips.view.list' },
}

const ARCHIVE_ID = 'trip-archive'

/**
 * The favourites scope and its count are the **caller's own** bookmarks (PRD #104 decision 5):
 * `loadTrips` filters and counts through `trip_favourites` keyed by the acting user, so a colleague's
 * star never lands in this reader's shortlist. Nothing here reads the deprecated `trips.is_favourite`
 * column, which held one boolean for the whole trip and so recorded nobody's choice.
 */
export const Route = createFileRoute('/_app/trips/')({
  validateSearch: searchSchema,
  /**
   * The URL is the truth; the remembered mode only fills a URL that says nothing (`01-S7`).
   *
   * Read in the browser only, under the same guard `01-S3` uses for the remembered tab: on the
   * Worker there is no storage, so a cold load of `/trips` stays a grid rather than painting one
   * layout and swapping to another after hydration. An in-app navigation that names no mode is
   * redirected once, replacing the entry, so Back does not land on the address it just left.
   */
  beforeLoad: ({ search }) => {
    if (typeof window === 'undefined') return
    const next = withRememberedView(search, TRIPS_VIEW_PREFERENCE.read().mode)
    if (next !== search) {
      throw redirect({ to: '/trips', search: next, replace: true })
    }
  },
  /**
   * The three keys that change what is read, and not the mode: switching layout re-renders the
   * page and never re-invokes `loadTrips`, so a toggle costs no D1 read.
   */
  loaderDeps: ({ search }) => ({
    status: search.status,
    q: search.q,
    scope: search.scope,
  }),
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
  const [preference, setPreference] = useLocalPreference(TRIPS_VIEW_PREFERENCE)

  const scope = search.scope ?? 'all'
  const view = search.view ?? DEFAULT_TRIP_VIEW
  const chooseView = (next: TripViewMode) => {
    setPreference({ ...preference, mode: next })
    void navigate({ search: { ...search, view: next }, replace: true })
  }
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
                  // The favourites figure is the reader's own shortlist, so it
                  // is absent rather than "0 favourites" until they have made
                  // one — the same rule the archived clause already follows.
                  ...(data.totals.favourites > 0
                    ? [
                        t('shell.trips.count.favourites', {
                          count: data.totals.favourites,
                          value: formatNumber(data.totals.favourites, locale),
                        }),
                      ]
                    : []),
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
                search={{ q: search.q, scope: search.scope, view: search.view }}
                className={filterLinkClass(search.status === undefined)}
              >
                {t('shell.trips.filter.all')}
                <FilterCount>{formatNumber(activeTotal, locale)}</FilterCount>
              </Link>
              {TRIP_STATUSES.map((status) => (
                <Link
                  key={status}
                  to="/trips"
                  search={{
                    status,
                    q: search.q,
                    scope: search.scope,
                    view: search.view,
                  }}
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
                  view: search.view,
                }}
                className={filterLinkClass(scope === 'favourites')}
              >
                <Star aria-hidden className="size-3.5" />
                {t('shell.trips.filter.favourites')}
                <FilterCount>
                  {formatNumber(data.totals.favourites, locale)}
                </FilterCount>
              </Link>
              <Link
                to="/trips"
                search={{
                  status: search.status,
                  q: search.q,
                  scope: scope === 'archived' ? undefined : 'archived',
                  view: search.view,
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

            <div className="flex shrink-0 items-center gap-3">
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
              <ViewSwitch view={view} onChange={chooseView} />
            </div>
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
                    <Link to="/trips" search={{ view: search.view }}>
                      {t('shell.trips.noMatch.action')}
                    </Link>
                  </Button>
                )
              }
            />
          </Card>
        ) : view === 'list' ? (
          /* This list is the page, under the page's own `h1`, so a trip is the
             second level here — the same reasoning as the grid below. */
          <TripList trips={data.trips} titleAs="h2" />
        ) : (
          <>
            <div
              /* Keyed by the mode, so switching back into the grid remounts it and
                 its entrance plays: a cross-fade with a small lift, transform and
                 opacity only, collapsed to opacity under reduced motion. */
              key={view}
              data-motion-transform=""
              className="hidden animate-rise md:block"
            >
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
            </div>
            {/* Below `md` the index is always rows: two columns of cover art on a
                phone is a squeezed desktop (`docs/SPEC.md` §2). Both are in the
                document and CSS picks one, so the first paint never waits on a
                media query the server cannot answer. */}
            <TripList trips={data.trips} titleAs="h2" className="md:hidden" />
          </>
        )}

        {scope === 'archived' || data.archivedTrips.length === 0 ? null : (
          <ArchivedTrips
            trips={data.archivedTrips}
            open={preference.archiveOpen}
            onOpenChange={(open) =>
              setPreference({ ...preference, archiveOpen: open })
            }
          />
        )}
      </AppSections>
    </AppFrame>
  )
}

/**
 * The layout switch. Above `md` only: below it the index is always rows, so a switch there would
 * be a control that changes nothing.
 */
function ViewSwitch({
  view,
  onChange,
}: {
  view: TripViewMode
  onChange: (next: TripViewMode) => void
}) {
  const t = useTranslate()
  return (
    <div
      role="group"
      aria-label={t('shell.trips.view.label')}
      className="hidden items-center gap-1 rounded-full bg-surface-2 p-1 md:flex"
    >
      {TRIP_VIEW_MODES.map((mode) => (
        <IconButton
          key={mode}
          icon={VIEW_OPTIONS[mode].icon}
          label={t(VIEW_OPTIONS[mode].label)}
          size="sm"
          variant={view === mode ? 'secondary' : 'ghost'}
          aria-pressed={view === mode}
          data-part={`trip-view-${mode}`}
          onClick={() => {
            if (view !== mode) onChange(mode)
          }}
        />
      ))}
    </div>
  )
}

/**
 * The archive, folded at the foot of the index (`01-S7`).
 *
 * A real disclosure — a button carrying `aria-expanded` and `aria-controls` — rather than a link
 * to the archived scope, which stays where it was for a reader who wants the archive as the page.
 * The rows are the list's rows, so each carries the trip's own menu: Copy for every reader, and
 * Restore and Delete permanently for an owner, through `01-S1`'s functions.
 *
 * The body is mounted and unmounted rather than transitioned open: a height transition animates
 * layout, which `DESIGN.md` forbids, so the rows rise in on their own. The open state is the second
 * field of `planned.trips-view`; it arrives after hydration, below every viewport's fold.
 */
function ArchivedTrips({
  trips,
  open,
  onOpenChange,
}: {
  trips: TripsPayload['archivedTrips']
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const locale = useLocale()
  const t = useTranslate()
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h2>
        <button
          type="button"
          data-part="trip-archive-disclosure"
          aria-expanded={open}
          aria-controls={ARCHIVE_ID}
          onClick={() => onOpenChange(!open)}
          className={cn(
            'flex items-center gap-2 rounded-lg px-2 py-2 text-start text-ink focus-ring',
            'transition-colors duration-fast ease-out-quint hover:bg-surface-2 active:bg-surface-inset',
          )}
        >
          <ChevronRight
            aria-hidden
            data-motion-transform=""
            data-mirror-rtl
            className={cn(
              'size-4 shrink-0 text-ink-4 transition-transform duration-fast ease-out-quint',
              open && 'rotate-90',
            )}
          />
          <Archive aria-hidden className="size-4 shrink-0 text-ink-3" />
          <span className="text-label font-semibold">
            {t('shell.tripStatus.archived')}
          </span>
          <Badge tone="neutral" size="sm" className="tabular-nums">
            {formatNumber(trips.length, locale)}
          </Badge>
        </button>
      </h2>
      {open ? (
        <div id={ARCHIVE_ID}>
          <TripList trips={trips} titleAs="h3" />
        </div>
      ) : null}
    </section>
  )
}

/**
 * The skeleton reads the mode from the URL, which the server and the browser both know, so it is
 * always the shape of the page about to arrive.
 */
function TripsPending() {
  const search = Route.useSearch()
  return (
    <AppFrame>
      <AppSections>
        <HeaderSkeleton />
        {search.view === 'list' ? (
          <Card padding="none" className="overflow-hidden">
            <RowsSkeleton rows={6} />
          </Card>
        ) : (
          <CardsSkeleton />
        )}
      </AppSections>
    </AppFrame>
  )
}
