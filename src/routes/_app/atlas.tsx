import { Link, createFileRoute } from '@tanstack/react-router'
import { Flag, Globe, MapPin, Sparkles, Telescope } from 'lucide-react'

import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { PageHeader } from '#/components/layout/page-header'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Progress,
  StatCard,
} from '#/components/ui'
import { WORLD_COUNTRY_COUNT, loadAtlas } from './-server/library'
import {
  countryFlag,
  countryName,
  formatDate,
  formatDistance,
  formatNumber,
  formatPercent,
  humaniseToken,
  pluralise,
} from './-lib/format'
import {
  HeaderSkeleton,
  Panel,
  PanelRow,
  RowsSkeleton,
  StatsSkeleton,
} from './-ui/scaffold'
import { WorldCoverageMap } from './-ui/world-map'

import type { AtlasPayload } from './-server/library'

export const Route = createFileRoute('/_app/atlas')({
  loader: () => loadAtlas(),
  pendingComponent: AtlasPending,
  errorComponent: ({ error }) => (
    <AppFrame>
      <ErrorPanel error={error} title="The atlas did not load" />
    </AppFrame>
  ),
  component: AtlasPage,
})

function AtlasPage() {
  const data = Route.useLoaderData()

  const share = data.countryCount / WORLD_COUNTRY_COUNT
  const allTime = data.stats.find((row) => row.statYear === 0)
  const byYear = data.stats.filter((row) => row.statYear > 0)
  const achieved = data.bucketList.filter((row) => row.isAchieved).length

  return (
    <AppFrame>
      <AppSections>
        <PageHeader
          eyebrow="World tracker"
          title="Atlas"
          description={
            data.countryCount === 0
              ? 'Nothing marked yet'
              : `${formatNumber(data.countryCount)} of ${WORLD_COUNTRY_COUNT} countries · ${formatPercent(share)} of the world`
          }
          actions={
            <Button asChild variant="secondary" size="sm" shape="pill">
              <Link to="/journey">Write it up</Link>
            </Button>
          }
        />

        <Coverage data={data} share={share} />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Globe />}
            label="Countries"
            value={data.countryCount}
            unit={`of ${WORLD_COUNTRY_COUNT}`}
            caption={`${formatPercent(share)} of the world`}
          />
          <StatCard
            icon={<MapPin />}
            label="Regions"
            value={data.regionCount}
            caption={
              data.regionCount === 0
                ? 'No regions marked yet'
                : 'States, provinces and prefectures'
            }
          />
          <StatCard
            icon={<Flag />}
            label="Visits"
            value={data.visitCount}
            caption={
              allTime === undefined
                ? 'Every recorded arrival'
                : `${pluralise(allTime.tripCount, 'trip')} · ${formatDistance(allTime.distanceMetres, 'metric')}`
            }
          />
          <StatCard
            icon={<Telescope />}
            label="Bucket list"
            value={achieved}
            unit={`of ${formatNumber(data.bucketList.length)}`}
            caption={
              data.bucketList.length === 0
                ? 'Nothing on the list yet'
                : `${formatNumber(data.bucketList.length - achieved)} still to go`
            }
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
          <div className="flex min-w-0 flex-col gap-6">
            <Panel
              label="Countries visited"
              count={formatNumber(data.countries.length)}
              flush
            >
              {data.countries.length === 0 ? (
                <div className="px-5 py-10">
                  <EmptyState
                    tone="brand"
                    icon={<Globe />}
                    title="Your map is still blank"
                    description="Mark a country as visited and it joins your atlas, with its first and last visit and the number of times you have been."
                  />
                </div>
              ) : (
                <ul>
                  {data.countries.map((row) => (
                    <li key={row.countryCode}>
                      <PanelRow>
                        <span
                          aria-hidden
                          className="w-6 shrink-0 text-center text-subtitle"
                        >
                          {countryFlag(row.countryCode)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-label font-semibold text-ink">
                            {countryName(row.countryCode)}
                          </p>
                          <p className="truncate text-caption text-ink-3">
                            {row.continent === null
                              ? 'Continent not recorded'
                              : humaniseToken(row.continent)}
                            {row.lastVisitedOn === null
                              ? ''
                              : ` · last ${formatDate(row.lastVisitedOn)}`}
                          </p>
                        </div>
                        <Badge
                          tone="neutral"
                          size="sm"
                          className="shrink-0 tabular-nums"
                        >
                          ×{formatNumber(row.visitCount)}
                        </Badge>
                      </PanelRow>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {byYear.length === 0 ? null : (
              <Panel
                label="Year by year"
                count={pluralise(byYear.length, 'year')}
                flush
              >
                <ul>
                  {byYear.map((row) => (
                    <li key={row.statYear}>
                      <PanelRow>
                        <span className="w-12 shrink-0 font-display text-subtitle font-bold tabular-nums text-ink">
                          {row.statYear}
                        </span>
                        <dl className="flex min-w-0 flex-1 flex-wrap gap-x-5 gap-y-1">
                          <YearFigure
                            label="Trips"
                            value={formatNumber(row.tripCount)}
                          />
                          <YearFigure
                            label="Countries"
                            value={formatNumber(row.countryCount)}
                          />
                          <YearFigure
                            label="Cities"
                            value={formatNumber(row.cityCount)}
                          />
                          <YearFigure
                            label="Days"
                            value={formatNumber(row.dayCount)}
                          />
                          <YearFigure
                            label="Distance"
                            value={formatDistance(row.distanceMetres, 'metric')}
                          />
                        </dl>
                      </PanelRow>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>

          <aside className="flex min-w-0 flex-col gap-6">
            <Panel
              label="Bucket list"
              count={
                data.bucketList.length === 0
                  ? undefined
                  : `${formatNumber(achieved)}/${formatNumber(data.bucketList.length)}`
              }
              flush
            >
              {data.bucketList.length === 0 ? (
                <div className="px-5 py-8">
                  <EmptyState
                    size="sm"
                    icon={<Sparkles />}
                    title="Nothing on the list"
                    description="Somewhere you have always meant to go. Add it and tick it off when you get there."
                  />
                </div>
              ) : (
                <ul>
                  {data.bucketList.map((row) => (
                    <li key={row.id}>
                      <PanelRow>
                        <span
                          aria-hidden
                          className="w-6 shrink-0 text-center text-label"
                        >
                          {row.countryCode === null
                            ? '📍'
                            : countryFlag(row.countryCode)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className={
                              row.isAchieved
                                ? 'truncate text-label text-ink-4 line-through'
                                : 'truncate text-label font-medium text-ink'
                            }
                          >
                            {row.name}
                          </p>
                          <p className="truncate text-caption text-ink-3">
                            {humaniseToken(row.kind)}
                            {row.targetYear === null
                              ? ''
                              : ` · by ${row.targetYear}`}
                          </p>
                        </div>
                        {row.isAchieved ? (
                          <Badge tone="success" size="sm" className="shrink-0">
                            Done
                          </Badge>
                        ) : null}
                      </PanelRow>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              label="Recent trips"
              count={
                data.recentTrips.length === 0
                  ? undefined
                  : formatNumber(data.recentTrips.length)
              }
              flush
            >
              {data.recentTrips.length === 0 ? (
                <div className="px-5 py-8">
                  <EmptyState
                    size="sm"
                    icon={<MapPin />}
                    title="No finished trips yet"
                    description="Trips that have ended feed the numbers on this page."
                  />
                </div>
              ) : (
                <ul>
                  {data.recentTrips.map((trip) => (
                    <li key={trip.id}>
                      <Link
                        to="/trips/$tripId/plan"
                        params={{ tripId: trip.id }}
                        className="flex min-w-0 items-center gap-3 px-5 py-3 text-left transition-colors duration-base ease-out-quint not-last:border-b not-last:border-edge-faint hover:bg-hover focus-ring-inset"
                      >
                        <span aria-hidden className="shrink-0 text-label">
                          {trip.countryCodes.length === 0
                            ? '🧭'
                            : trip.countryCodes
                                .slice(0, 2)
                                .map(countryFlag)
                                .join('')}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-label font-medium text-ink">
                          {trip.title}
                        </span>
                        <span className="shrink-0 text-caption tabular-nums text-ink-4">
                          {formatDate(trip.endDate) ?? '—'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </aside>
        </div>
      </AppSections>
    </AppFrame>
  )
}

function YearFigure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-micro font-semibold tracking-label uppercase text-ink-4">
        {label}
      </dt>
      <dd className="text-caption font-semibold tabular-nums text-ink-2">
        {value}
      </dd>
    </div>
  )
}

function Coverage({ data, share }: { data: AtlasPayload; share: number }) {
  const continents = [...data.byContinent].sort(
    (left, right) => right.countryCount - left.countryCount,
  )

  return (
    <Card
      variant="inverse"
      padding="none"
      className="relative isolate overflow-hidden"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-28 -left-16 size-72 rounded-full bg-brand/25 blur-3xl"
      />
      <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-center lg:gap-10">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="min-w-0">
            <p className="mb-2 text-micro font-semibold tracking-label uppercase text-inverse-muted">
              World coverage
            </p>
            <p className="flex items-baseline gap-2">
              <span className="font-display text-[clamp(3.75rem,9vw,5.5rem)] leading-[0.85] font-extrabold tracking-tighter tabular-nums text-inverse-on">
                {formatNumber(data.countryCount)}
              </span>
              <span className="text-title font-medium text-inverse-muted">
                of {WORLD_COUNTRY_COUNT}
              </span>
            </p>
            <p className="mt-2 text-label text-inverse-muted">
              {formatPercent(share)} of the world,{' '}
              {pluralise(data.visitCount, 'visit')} recorded
            </p>
          </div>

          {continents.length === 0 ? (
            <p className="text-label text-inverse-muted">
              Mark the countries you have been to and this fills in by
              continent.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {continents.map((row) => (
                <li key={row.continent}>
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="truncate text-caption font-medium text-inverse-on">
                      {humaniseToken(row.continent)}
                    </span>
                    <span className="shrink-0 text-caption tabular-nums text-inverse-muted">
                      {formatNumber(row.countryCount)}
                    </span>
                  </div>
                  <div
                    aria-hidden
                    className="h-1.5 overflow-hidden rounded-full bg-inverse-surface"
                  >
                    <span
                      className="block h-full rounded-full bg-inverse-brand"
                      style={{
                        width: formatPercent(
                          row.countryCount /
                            Math.max(continents[0]?.countryCount ?? 1, 1),
                        ),
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Progress
            value={data.countryCount}
            max={WORLD_COUNTRY_COUNT}
            size="sm"
            tone="brand"
            label={
              <span className="text-inverse-muted">Towards every country</span>
            }
            valueText={
              <span className="text-inverse-muted">
                {formatNumber(WORLD_COUNTRY_COUNT - data.countryCount)} to go
              </span>
            }
          />

          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-micro font-semibold tracking-label uppercase text-inverse-muted">
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2.5 rounded-full bg-inverse-brand"
              />
              Been there
            </span>
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2.5 rounded-full bg-inverse-surface ring-1 ring-inverse-edge"
              />
              Still to go
            </span>
          </p>
        </div>

        <div className="-mx-2 min-w-0 sm:-mx-4 lg:mx-0">
          <WorldCoverageMap
            visited={data.countries.map((row) => row.countryCode)}
            label={
              data.countryCount === 0
                ? 'World map. No countries marked yet.'
                : `World map with ${pluralise(data.countryCount, 'country', 'countries')} marked as visited: ${data.countries
                    .map((row) => countryName(row.countryCode))
                    .join(', ')}.`
            }
          />
        </div>
      </div>
    </Card>
  )
}

function AtlasPending() {
  return (
    <AppFrame>
      <AppSections>
        <HeaderSkeleton />
        <StatsSkeleton />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
          <Card padding="none">
            <RowsSkeleton rows={6} />
          </Card>
          <Card padding="none">
            <RowsSkeleton rows={4} />
          </Card>
        </div>
      </AppSections>
    </AppFrame>
  )
}
