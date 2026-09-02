import { Link, createFileRoute } from '@tanstack/react-router'
import { Bookmark, ChevronLeft, ExternalLink, MapPin, Tag } from 'lucide-react'
import { z } from 'zod'

import { useLocale } from '#/lib/i18n'
import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { NotFoundPanel } from '#/components/layout/not-found'
import { PageHeader } from '#/components/layout/page-header'
import { Badge, Button, Card, EmptyState } from '#/components/ui'
import { loadCollectionDetail } from '../-server/library'
import {
  countryFlag,
  countryName,
  formatMoneyMinor,
  formatNumber,
  humaniseToken,
  pluralise,
} from '../-lib/format'
import { COLLECTION_STATUS_TONE, toneFor } from '../-lib/tone'
import {
  CardsSkeleton,
  FilterBar,
  FilterCount,
  HeaderSkeleton,
  filterLinkClass,
} from '../-ui/scaffold'

const STATUSES = [
  'idea',
  'shortlisted',
  'planned',
  'visited',
  'rejected',
] as const

export const Route = createFileRoute('/_app/collections/$collectionId')({
  validateSearch: z.object({
    status: z.enum(STATUSES).optional(),
    label: z.string().trim().min(1).max(64).optional(),
  }),
  loader: ({ params }) =>
    loadCollectionDetail({ data: { collectionId: params.collectionId } }),
  pendingComponent: CollectionPending,
  notFoundComponent: () => (
    <AppFrame>
      <NotFoundPanel />
    </AppFrame>
  ),
  errorComponent: ({ error }) => (
    <AppFrame>
      <ErrorPanel error={error} title="This collection did not load" />
    </AppFrame>
  ),
  component: CollectionPage,
})

function CollectionPage() {
  const locale = useLocale()
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const { collectionId } = Route.useParams()

  const visible = data.places.filter((place) => {
    if (search.status !== undefined && place.status !== search.status) {
      return false
    }
    if (search.label !== undefined && !place.labelIds.includes(search.label)) {
      return false
    }
    return true
  })

  const countFor = (status: string): number =>
    data.byStatus.find((row) => row.status === status)?.value ?? 0

  return (
    <AppFrame>
      <AppSections>
        <PageHeader
          eyebrow="Collection"
          title={data.collection.name}
          description={
            data.collection.description ??
            pluralise(data.collection.placeCount, 'saved place')
          }
          actions={
            <>
              <Button asChild variant="ghost" size="sm" shape="pill">
                <Link to="/collections">
                  <ChevronLeft aria-hidden />
                  All collections
                </Link>
              </Button>
              <Badge tone="outline" size="lg">
                {humaniseToken(data.collection.visibility)}
              </Badge>
            </>
          }
        >
          <FilterBar>
            <Link
              to="/collections/$collectionId"
              params={{ collectionId }}
              search={{ label: search.label }}
              className={filterLinkClass(search.status === undefined)}
            >
              All
              <FilterCount>
                {formatNumber(data.places.length, locale)}
              </FilterCount>
            </Link>
            {STATUSES.map((status) => (
              <Link
                key={status}
                to="/collections/$collectionId"
                params={{ collectionId }}
                search={{ status, label: search.label }}
                className={filterLinkClass(search.status === status)}
              >
                {humaniseToken(status)}
                <FilterCount>
                  {formatNumber(countFor(status), locale)}
                </FilterCount>
              </Link>
            ))}
            {data.labels.length === 0 ? null : (
              <>
                <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-edge" />
                {data.labels.map((label) => (
                  <Link
                    key={label.id}
                    to="/collections/$collectionId"
                    params={{ collectionId }}
                    search={{
                      status: search.status,
                      label: search.label === label.id ? undefined : label.id,
                    }}
                    className={filterLinkClass(search.label === label.id)}
                  >
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ backgroundColor: label.colour }}
                    />
                    {label.name}
                  </Link>
                ))}
              </>
            )}
          </FilterBar>
        </PageHeader>

        {visible.length === 0 ? (
          <Card variant="dashed" padding="none">
            <EmptyState
              size="lg"
              tone="brand"
              icon={<Bookmark />}
              title={
                data.places.length === 0
                  ? 'Nothing saved here yet'
                  : 'Nothing matches that filter'
              }
              description={
                data.places.length === 0
                  ? 'Save a place from the map, from another trip, or straight from a recommendation, and it lands in this collection.'
                  : 'Try another status, or clear the label you are filtering by.'
              }
              action={
                data.places.length === 0 ? undefined : (
                  <Button asChild variant="primary" shape="pill">
                    <Link
                      to="/collections/$collectionId"
                      params={{ collectionId }}
                      search={{}}
                    >
                      Reset filters
                    </Link>
                  </Button>
                )
              }
            />
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((place) => (
              <li key={place.id} className="min-w-0">
                <Card
                  padding="none"
                  className="flex h-full flex-col overflow-hidden"
                >
                  {place.imageUrl === null ? null : (
                    <img
                      src={place.imageUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-28 w-full shrink-0 object-cover"
                    />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-2 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="min-w-0 truncate text-label font-semibold text-ink">
                        {place.name}
                      </h2>
                      <Badge
                        tone={toneFor(COLLECTION_STATUS_TONE, place.status)}
                        size="sm"
                        className="shrink-0"
                      >
                        {humaniseToken(place.status)}
                      </Badge>
                    </div>

                    <p className="inline-flex min-w-0 items-center gap-1.5 truncate text-caption text-ink-3">
                      {place.countryCode === null ? (
                        <MapPin
                          aria-hidden
                          className="size-3.5 shrink-0 text-ink-4"
                        />
                      ) : (
                        <span aria-hidden>
                          {countryFlag(place.countryCode)}
                        </span>
                      )}
                      {[
                        place.city,
                        place.countryCode === null
                          ? null
                          : countryName(place.countryCode),
                      ]
                        .filter((part) => part !== null && part !== '')
                        .join(', ') || 'Location not recorded'}
                    </p>

                    {place.description === null ? null : (
                      <p className="line-clamp-3 text-caption leading-relaxed text-ink-3">
                        {place.description}
                      </p>
                    )}

                    {place.labelIds.length === 0 ? null : (
                      <ul className="flex flex-wrap gap-1.5">
                        {place.labelIds.map((labelId) => {
                          const label = data.labels.find(
                            (row) => row.id === labelId,
                          )
                          if (label === undefined) {
                            return null
                          }
                          return (
                            <li
                              key={labelId}
                              className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-caption text-ink-2"
                            >
                              <span
                                aria-hidden
                                className="size-2 rounded-full"
                                style={{ backgroundColor: label.colour }}
                              />
                              {label.name}
                            </li>
                          )
                        })}
                      </ul>
                    )}

                    <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                      {place.priceMinor === null ? (
                        <span className="text-caption text-ink-4">
                          No price noted
                        </span>
                      ) : (
                        <span className="text-caption font-semibold tabular-nums text-ink-2">
                          {formatMoneyMinor(
                            place.priceMinor,
                            place.currency ?? 'EUR',
                            locale,
                          )}
                        </span>
                      )}
                      {place.website === null ? null : (
                        <Button asChild variant="ghost" size="sm" shape="pill">
                          <a
                            href={place.website}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            Website
                            <ExternalLink aria-hidden />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}

        {data.labels.length === 0 ? null : (
          <Card>
            <p className="mb-3 inline-flex items-center gap-2 text-micro font-semibold tracking-label uppercase text-ink-3">
              <Tag aria-hidden className="size-3.5" />
              Labels in this collection
            </p>
            <ul className="flex flex-wrap gap-2">
              {data.labels.map((label) => (
                <li
                  key={label.id}
                  className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1 text-caption text-ink-2"
                >
                  <span
                    aria-hidden
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: label.colour }}
                  />
                  {label.name}
                  <span className="tabular-nums text-ink-4">
                    {formatNumber(
                      data.places.filter((place) =>
                        place.labelIds.includes(label.id),
                      ).length,
                      locale,
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </AppSections>
    </AppFrame>
  )
}

function CollectionPending() {
  return (
    <AppFrame>
      <AppSections>
        <HeaderSkeleton />
        <CardsSkeleton cards={6} />
      </AppSections>
    </AppFrame>
  )
}
