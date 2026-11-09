import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  MarketingFooter,
  MarketingHeader,
  SkipToContent,
} from '#/components/marketing/chrome'
import { TripArt } from '#/components/gallery/trip-art'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Input,
  SectionLabel,
  Skeleton,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import './browse-screen.css'
import { formatDate, formatNumber } from '#/lib/format'
import { useLocale, useTranslate } from '#/lib/i18n'
import type { TripArtPoint } from '#/server/community/read-model'

export interface BrowseEntry {
  readonly slug: string
  readonly title: string
  readonly summary: string
  readonly attribution: string
  readonly dayCount: number
  readonly placeCount: number
  /** Already localized for the provider locale by the data owner, identical for SSR and hydration. */
  readonly countryNames: ReadonlyArray<string>
  readonly publishedAt: string
  readonly art: ReadonlyArray<TripArtPoint>
}

export type BrowseState =
  | { readonly kind: 'ready'; readonly items: ReadonlyArray<BrowseEntry> }
  | { readonly kind: 'loading' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'rate-limited'; readonly retryAfterSeconds: number }

export interface BrowseScreenProps {
  readonly state: BrowseState
  /** Supplied by the eventual route owner; this composition registers no destination. */
  readonly hrefFor: (entry: BrowseEntry) => string
  readonly onRetry?: () => void
}

const subscribe = () => () => {}

export function BrowseScreen({ state, hrefFor, onRetry }: BrowseScreenProps) {
  const t = useTranslate()
  const locale = useLocale()
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
  const [query, setQuery] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const needle = query.trim().normalize('NFC').toLocaleLowerCase(locale)
  const items =
    state.kind === 'ready'
      ? [...state.items].sort(
          (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
        )
      : []
  const matches = items.filter((item) =>
    [item.title, item.summary, item.attribution, ...item.countryNames]
      .join(' ')
      .normalize('NFC')
      .toLocaleLowerCase(locale)
      .includes(needle),
  )
  const searching = needle.length > 0
  const resultMessage = searching
    ? t(
        matches.length === 0
          ? 'marketing.gallery.noTripsFound'
          : 'marketing.gallery.results',
        { count: matches.length, value: formatNumber(matches.length, locale) },
      )
    : ''
  useEffect(() => {
    const timer = setTimeout(() => setAnnouncement(resultMessage), 250)
    return () => clearTimeout(timer)
  }, [resultMessage])

  function tripLink(item: BrowseEntry, index: number, hero = false) {
    return (
      <Card asChild padding="none" key={item.slug}>
        <a
          href={hrefFor(item)}
          data-testid={hero ? 'gallery-hero' : undefined}
          className={cn(
            'gallery-card group block min-w-0 overflow-hidden focus-ring transition-transform duration-base ease-out-quint motion-safe:hover:-translate-y-px motion-reduce:transform-none motion-reduce:transition-none',
            hero && 'sm:grid sm:grid-cols-2',
          )}
          style={{ animationDelay: `${Math.min(index, 7) * 24}ms` }}
        >
          <TripArt
            points={item.art}
            dayCount={item.dayCount}
            className={cn(hero && 'h-full object-cover')}
          />
          <div
            className={cn(
              'space-y-3 p-5',
              hero && 'flex flex-col justify-center sm:p-8',
            )}
          >
            <h2
              className={cn(
                'break-words font-display text-title text-ink',
                hero && 'sm:text-display',
              )}
            >
              {item.title}
            </h2>
            <p className="break-words text-body text-ink-2">{item.summary}</p>
            <p className="break-words text-label text-ink-3">
              {t('marketing.gallery.by', { name: item.attribution })}
            </p>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-label text-ink-2">
              <span>
                {t('marketing.gallery.days', {
                  count: item.dayCount,
                  value: formatNumber(item.dayCount, locale),
                })}
              </span>
              <span>
                {t('marketing.gallery.places', {
                  count: item.placeCount,
                  value: formatNumber(item.placeCount, locale),
                })}
              </span>
            </p>
            <p className="text-label text-ink-3">
              {item.countryNames.join(' · ')}
            </p>
            <p className="text-micro text-ink-3">
              {t('marketing.gallery.published', {
                date: formatDate(item.publishedAt, locale) ?? '',
              })}
            </p>
            <span className="text-label font-semibold text-brand">
              {t('marketing.gallery.read')} <span aria-hidden="true">↗</span>
            </span>
          </div>
        </a>
      </Card>
    )
  }

  return (
    <>
      <SkipToContent />
      <MarketingHeader />
      <main
        id="main"
        className="mx-auto w-full max-w-content space-y-8 py-12 gutter-x sm:py-16"
      >
        <div className="max-w-prose space-y-4">
          <SectionLabel truncate={false}>
            {t('marketing.gallery.eyebrow')}
          </SectionLabel>
          <h1
            ref={heading}
            tabIndex={-1}
            className="font-display text-title font-extrabold tracking-tighter text-ink sm:text-display"
          >
            {t('marketing.gallery.heading')}
          </h1>
          <p className="text-body text-ink-2">{t('marketing.gallery.intro')}</p>
        </div>
        {state.kind === 'ready' && items.length > 0 ? (
          <>
            {hydrated ? (
              <div role="search" className="max-w-prose space-y-2">
                <label
                  htmlFor="gallery-search"
                  className="text-label font-medium text-ink"
                >
                  {t('marketing.gallery.searchLabel')}
                </label>
                <div className="flex gap-2">
                  <Input
                    ref={input}
                    id="gallery-search"
                    type="search"
                    maxLength={200}
                    placeholder={t('marketing.gallery.searchPlaceholder')}
                    value={query}
                    onChange={(event) =>
                      setQuery(event.target.value.slice(0, 200))
                    }
                  />
                  {query ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setQuery('')
                        input.current?.focus()
                      }}
                    >
                      {t('marketing.gallery.clearSearch')}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
            <noscript>
              <p className="text-label text-ink-3">
                {t('marketing.gallery.searchNoscript')}
              </p>
            </noscript>
            <p className="text-label text-ink-2">{resultMessage}</p>
            <p
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            >
              {announcement}
            </p>
            {searching && matches.length === 0 ? (
              <EmptyState
                titleAs="h2"
                title={t('marketing.gallery.noResults', { query })}
                variant="filled"
              />
            ) : null}
            {!searching && items[0] ? tripLink(items[0], 0, true) : null}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {(searching ? matches : items.slice(1)).map((item, index) =>
                tripLink(item, index),
              )}
            </div>
          </>
        ) : null}
        {state.kind === 'ready' && items.length === 0 ? (
          <>
            <div className="mx-auto max-w-sm">
              <TripArt points={[]} />
            </div>
            <EmptyState
              titleAs="h2"
              title={t('marketing.gallery.emptyTitle')}
              description={t('marketing.gallery.emptyBody')}
            />
          </>
        ) : null}
        {state.kind === 'loading' ? (
          <section aria-busy="true">
            <p role="status">{t('marketing.gallery.loading')}</p>
            <Skeleton className="mt-6 aspect-[8/5] w-full" />
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="aspect-[8/5]" />
              ))}
            </div>
          </section>
        ) : null}
        {state.kind === 'unavailable' ? (
          <Alert
            tone="warning"
            title={t('marketing.gallery.errorTitle')}
            actions={
              onRetry ? (
                <Button
                  onClick={() => {
                    heading.current?.focus()
                    onRetry?.()
                  }}
                >
                  {t('modules.collab.thread.retry')}
                </Button>
              ) : undefined
            }
          >
            {t('marketing.gallery.errorBody')}
          </Alert>
        ) : null}
        {state.kind === 'rate-limited' ? (
          <Alert tone="warning">
            {t('marketing.gallery.rateLimited', {
              count: Math.max(1, Math.ceil(state.retryAfterSeconds)),
              seconds: formatNumber(
                Math.max(1, Math.ceil(state.retryAfterSeconds)),
                locale,
              ),
            })}
          </Alert>
        ) : null}
      </main>
      <MarketingFooter />
    </>
  )
}
