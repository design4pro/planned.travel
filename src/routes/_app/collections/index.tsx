import { Link, createFileRoute } from '@tanstack/react-router'
import { Bookmark, Globe, MapPin } from 'lucide-react'

import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { PageHeader } from '#/components/layout/page-header'
import { Badge, Card, EmptyState } from '#/components/ui'
import { loadCollections } from '../-server/library'
import {
  countryFlag,
  countryName,
  formatNumber,
  humaniseToken,
  pluralise,
} from '../-lib/format'
import { NewCollectionDialog } from '../-ui/create-dialogs'
import { CardsSkeleton, HeaderSkeleton, Panel } from '../-ui/scaffold'

export const Route = createFileRoute('/_app/collections/')({
  loader: () => loadCollections(),
  pendingComponent: CollectionsPending,
  errorComponent: ({ error }) => (
    <AppFrame>
      <ErrorPanel error={error} title="Your collections did not load" />
    </AppFrame>
  ),
  component: CollectionsPage,
})

function CollectionsPage() {
  const data = Route.useLoaderData()
  const saved = data.collections.reduce(
    (total, row) => total + row.placeCount,
    0,
  )

  return (
    <AppFrame>
      <AppSections>
        <PageHeader
          eyebrow="Saved places"
          title="Collections"
          description={
            data.collections.length === 0
              ? 'Keep the places you find before you know which trip they belong to'
              : `${pluralise(data.collections.length, 'collection')} · ${pluralise(saved, 'saved place')}`
          }
          actions={<NewCollectionDialog />}
        />

        {data.collections.length === 0 ? (
          <Card variant="dashed" padding="none">
            <EmptyState
              size="lg"
              tone="brand"
              icon={<Bookmark />}
              title="No collections yet"
              description="A restaurant a friend recommended, a hotel you saw in a magazine, a hike you will get to eventually. Collections hold all of it until a trip needs it."
              action={<NewCollectionDialog size="md" />}
            />
          </Card>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-8">
            <ul className="grid min-w-0 gap-4 sm:grid-cols-2">
              {data.collections.map((collection) => (
                <li key={collection.id} className="min-w-0">
                  <Card
                    asChild
                    interactive
                    padding="none"
                    className="h-full overflow-hidden"
                  >
                    <Link
                      to="/collections/$collectionId"
                      params={{ collectionId: collection.id }}
                      className="flex h-full flex-col focus-ring"
                    >
                      <span
                        aria-hidden
                        className="h-1.5 w-full shrink-0"
                        style={{ backgroundColor: collection.colour }}
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-2 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <h2 className="min-w-0 truncate font-display text-subtitle font-bold tracking-tight text-ink">
                            {collection.name}
                          </h2>
                          <Badge tone="outline" size="sm" className="shrink-0">
                            {humaniseToken(collection.visibility)}
                          </Badge>
                        </div>
                        {collection.description === null ? null : (
                          <p className="line-clamp-2 text-caption leading-relaxed text-ink-3">
                            {collection.description}
                          </p>
                        )}
                        <p className="mt-auto inline-flex items-center gap-1.5 pt-2 text-caption text-ink-3">
                          <MapPin aria-hidden className="size-3.5 text-ink-4" />
                          <span className="tabular-nums">
                            {pluralise(collection.placeCount, 'place')}
                          </span>
                        </p>
                      </div>
                    </Link>
                  </Card>
                </li>
              ))}
            </ul>

            <aside className="min-w-0">
              <Panel
                label="Where they are"
                count={
                  data.byCountry.length === 0
                    ? undefined
                    : formatNumber(data.byCountry.length)
                }
                flush
              >
                {data.byCountry.length === 0 ? (
                  <div className="px-5 py-8">
                    <EmptyState
                      size="sm"
                      icon={<Globe />}
                      title="No countries yet"
                      description="Saved places with a country show up here, busiest first."
                    />
                  </div>
                ) : (
                  <ul>
                    {data.byCountry.map((row) => (
                      <li
                        key={row.countryCode}
                        className="flex items-center gap-3 px-5 py-2.5 not-last:border-b not-last:border-edge-faint"
                      >
                        <span
                          aria-hidden
                          className="w-6 shrink-0 text-center text-label"
                        >
                          {countryFlag(row.countryCode)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-caption text-ink">
                          {countryName(row.countryCode)}
                        </span>
                        <span className="shrink-0 text-caption tabular-nums text-ink-4">
                          {formatNumber(row.value)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </aside>
          </div>
        )}
      </AppSections>
    </AppFrame>
  )
}

function CollectionsPending() {
  return (
    <AppFrame>
      <AppSections>
        <HeaderSkeleton />
        <CardsSkeleton cards={4} />
      </AppSections>
    </AppFrame>
  )
}
