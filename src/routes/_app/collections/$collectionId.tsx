import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CollectionActions } from '#/components/collections/collection-actions'
import { StatusPicker } from '#/components/collections/status-picker'
import {
  COLLECTION_PLACE_STATUSES,
  STATUS_KEYS,
} from '#/components/collections/status-copy'
import {
  collectionDeleteSummaryFn,
  deleteCollectionFn,
  setPlaceStatusFn,
  updateCollectionFn,
} from '../-server/collections'
import { Bookmark, ChevronLeft, ExternalLink, MapPin, Tag } from 'lucide-react'
import { z } from 'zod'

import { useLocale, useTranslate } from '#/lib/i18n'
import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { NotFoundPanel } from '#/components/layout/not-found'
import { PageHeader } from '#/components/layout/page-header'
import { Button, Card, EmptyState } from '#/components/ui'
import { loadCollectionDetail, loadCollections } from '../-server/library'
import {
  countryFlag,
  countryName,
  formatMoneyMinor,
  formatNumber,
} from '../-lib/format'
import {
  CardsSkeleton,
  FilterBar,
  FilterCount,
  HeaderSkeleton,
  filterLinkClass,
} from '../-ui/scaffold'

export const Route = createFileRoute('/_app/collections/$collectionId')({
  validateSearch: z.object({
    status: z.enum(COLLECTION_PLACE_STATUSES).optional(),
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
  errorComponent: CollectionError,
  component: CollectionPage,
})

function CollectionPage() {
  const locale = useLocale()
  const t = useTranslate()
  const router = useRouter()
  const [announcement, setAnnouncement] = useState('')
  const cards = useRef<HTMLUListElement>(null)
  const empty = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
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

  useEffect(() => {
    setAnnouncement(
      t('modules.collections.filtered.showing', { count: visible.length }),
    )
  }, [search.status, search.label, visible.length, t])

  const countFor = (status: string): number =>
    data.byStatus.find((row) => row.status === status)?.value ?? 0

  return (
    <AppFrame>
      <AppSections>
        <PageHeader
          eyebrow={t('modules.collections.page.eyebrow')}
          title={data.collection.name}
          description={
            data.collection.description ??
            t('modules.collections.page.savedPlaces', {
              count: data.collection.placeCount,
            })
          }
          actions={
            <>
              <CollectionActions
                canManage={data.canManage}
                collection={data.collection}
                readCurrent={async () =>
                  (await loadCollectionDetail({ data: { collectionId } }))
                    .collection
                }
                update={(input) => updateCollectionFn({ data: input })}
                summary={(input) => collectionDeleteSummaryFn({ data: input })}
                remove={(input) => deleteCollectionFn({ data: input })}
                exists={async () =>
                  (await loadCollections()).collections.some(
                    (row) => row.id === collectionId,
                  )
                }
                onSaved={() => router.invalidate()}
                onDeleted={async () => {
                  await router.navigate({ to: '/collections' })
                  toast.success(t('modules.collections.delete.deleted'))
                }}
              />
              <Button asChild variant="ghost" size="sm" shape="pill">
                <Link to="/collections">
                  <ChevronLeft aria-hidden data-mirror-rtl />
                  {t('modules.collections.page.back')}
                </Link>
              </Button>
            </>
          }
        >
          <FilterBar aria-label={t('modules.collections.filters.statusGroup')}>
            <Link
              to="/collections/$collectionId"
              params={{ collectionId }}
              search={{ label: search.label }}
              className={filterLinkClass(search.status === undefined)}
            >
              {t('modules.collections.page.all')}
              <FilterCount>
                {formatNumber(data.places.length, locale)}
              </FilterCount>
            </Link>
            {COLLECTION_PLACE_STATUSES.map((status) => (
              <Link
                key={status}
                to="/collections/$collectionId"
                params={{ collectionId }}
                search={{ status, label: search.label }}
                className={filterLinkClass(search.status === status)}
              >
                {t(STATUS_KEYS[status])}
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
                    aria-label={
                      t('modules.collections.labels.filterGroup') +
                      ': ' +
                      label.name
                    }
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

        <div role="status" aria-live="polite" className="sr-only">
          {announcement}
        </div>
        {visible.length > 0 ? (
          <h2
            ref={heading}
            tabIndex={-1}
            className="text-caption text-ink-3 focus-ring"
          >
            {t('modules.collections.filtered.showing', {
              count: visible.length,
            })}
          </h2>
        ) : null}
        {visible.length === 0 ? (
          <Card
            ref={empty}
            variant="dashed"
            padding="none"
            className="[&_h2]:focus-ring"
          >
            <EmptyState
              titleAs="h2"
              size="lg"
              tone="brand"
              icon={<Bookmark />}
              title={
                data.places.length === 0
                  ? t('modules.collections.empty.title')
                  : t('modules.collections.filtered.title')
              }
              description={
                data.places.length === 0
                  ? t('modules.collections.empty.body')
                  : t('modules.collections.filtered.body')
              }
              action={
                data.places.length === 0 ? undefined : (
                  <Button asChild variant="primary" shape="pill">
                    <Link
                      to="/collections/$collectionId"
                      params={{ collectionId }}
                      search={{}}
                    >
                      {t('modules.collections.filtered.reset')}
                    </Link>
                  </Button>
                )
              }
            />
          </Card>
        ) : (
          <ul ref={cards} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                      <StatusPicker
                        place={place}
                        readCurrent={async () => {
                          const current = await loadCollectionDetail({
                            data: { collectionId },
                          })
                          const saved = current.places.find(
                            (row) => row.id === place.id,
                          )
                          if (!saved) throw new Error()
                          return saved.status
                        }}
                        setStatus={(input) => setPlaceStatusFn({ data: input })}
                        onSaved={async (status) => {
                          const index = visible.findIndex(
                            (row) => row.id === place.id,
                          )
                          const hidden =
                            search.status !== undefined &&
                            status !== search.status
                          await router.invalidate()
                          setAnnouncement(
                            t(
                              hidden
                                ? 'modules.collections.statusPicker.hiddenNow'
                                : 'modules.collections.statusPicker.saved',
                              {
                                place: place.name,
                                status: t(STATUS_KEYS[status]),
                              },
                            ),
                          )
                          if (hidden) {
                            await new Promise<void>((resolve) =>
                              requestAnimationFrame(() => resolve()),
                            )
                            const next = cards.current?.children
                              .item(index)
                              ?.querySelector('button')
                            if (next instanceof HTMLElement) next.focus()
                            else {
                              const emptyHeading =
                                empty.current?.querySelector('h2')
                              if (emptyHeading) {
                                emptyHeading.tabIndex = -1
                                emptyHeading.focus()
                              } else heading.current?.focus()
                            }
                          }
                        }}
                      />
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
                        .join(', ') || t('modules.collections.card.noLocation')}
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
                          {t('modules.collections.card.noPrice')}
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
                            {t('modules.collections.card.website')}
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
              {t('modules.collections.labels.panel')}
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

function CollectionError({ error }: { error: Error }) {
  const t = useTranslate()
  return (
    <AppFrame>
      <ErrorPanel
        error={error}
        title={t('modules.collections.page.loadErrorTitle')}
      />
    </AppFrame>
  )
}
