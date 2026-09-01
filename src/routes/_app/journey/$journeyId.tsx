import { Link, createFileRoute } from '@tanstack/react-router'
import {
  Camera,
  ChevronLeft,
  CloudSun,
  MapPin,
  NotebookPen,
  Thermometer,
} from 'lucide-react'

import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { NotFoundPanel } from '#/components/layout/not-found'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
} from '#/components/ui'
import { useLocale, useTranslate } from '#/lib/i18n'
import { loadJourneyStory } from '../-server/library'
import {
  formatDate,
  formatDateRange,
  formatNumber,
  formatTime,
  humaniseToken,
} from '../-lib/format'
import { JOURNEY_STATUS_TONE, toneFor } from '../-lib/tone'
import { HeaderSkeleton, Panel } from '../-ui/scaffold'

import type { JourneyEntryCard, JourneyStoryPayload } from '../-server/library'

export const Route = createFileRoute('/_app/journey/$journeyId')({
  loader: ({ params }) =>
    loadJourneyStory({ data: { journeyId: params.journeyId } }),
  pendingComponent: StoryPending,
  notFoundComponent: () => (
    <AppFrame>
      <NotFoundPanel />
    </AppFrame>
  ),
  errorComponent: StoryError,
  component: StoryPage,
})

function StoryError({ error }: { error: Error }) {
  const t = useTranslate()

  return (
    <AppFrame>
      <ErrorPanel error={error} title={t('journal.story.error')} />
    </AppFrame>
  )
}

function StoryPage() {
  const t = useTranslate()
  const locale = useLocale()
  const data = Route.useLoaderData()
  const { journey } = data
  const range = formatDateRange(journey.startedOn, journey.endedOn, locale)

  return (
    <AppFrame>
      <AppSections>
        <Card
          variant="inverse"
          padding="none"
          className="relative isolate overflow-hidden"
        >
          {journey.coverImageUrl === null ? (
            <span
              aria-hidden
              className="pointer-events-none absolute -top-32 -end-20 size-80 rounded-full bg-brand/30 blur-3xl"
            />
          ) : (
            <>
              <img
                src={journey.coverImageUrl}
                alt=""
                fetchPriority="high"
                className="absolute inset-0 -z-10 size-full object-cover opacity-40"
              />
              <span
                aria-hidden
                className="absolute inset-0 -z-10 bg-inverse/60"
              />
            </>
          )}

          <div className="relative flex flex-col gap-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button asChild variant="inverse" size="sm" shape="pill">
                <Link to="/journey">
                  <ChevronLeft aria-hidden />
                  {t('journal.story.back')}
                </Link>
              </Button>
              <Badge
                tone={toneFor(JOURNEY_STATUS_TONE, journey.status)}
                size="sm"
              >
                {humaniseToken(journey.status)}
              </Badge>
            </div>

            <div className="min-w-0">
              <h1 className="font-display text-[clamp(2rem,6vw,3.75rem)] leading-[0.95] font-extrabold tracking-tighter text-inverse-on">
                {journey.title}
              </h1>
              {journey.subtitle === null ? null : (
                <p className="mt-3 max-w-2xl text-body leading-relaxed text-inverse-muted">
                  {journey.subtitle}
                </p>
              )}
            </div>

            <dl className="flex flex-wrap gap-x-8 gap-y-3">
              <CoverFigure
                label={t('journal.figure.entries')}
                value={formatNumber(journey.entryCount, locale)}
              />
              <CoverFigure
                label={t('journal.figure.photos')}
                value={formatNumber(journey.photoCount, locale)}
              />
              <CoverFigure
                label={t('journal.figure.dates')}
                value={range ?? t('journal.value.notSet')}
              />
              <CoverFigure
                label={t('journal.figure.visibility')}
                value={humaniseToken(journey.visibility)}
              />
            </dl>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-8">
          <div className="min-w-0">
            {data.entries.length === 0 ? (
              <Card variant="dashed" padding="none">
                <EmptyState
                  size="lg"
                  tone="brand"
                  icon={<NotebookPen />}
                  title={t('journal.entries.empty.title')}
                  description={t('journal.entries.empty.body')}
                />
              </Card>
            ) : (
              <ol className="flex flex-col gap-5">
                {data.entries.map((entry) => (
                  <li key={entry.id} className="min-w-0">
                    <EntryCard entry={entry} data={data} />
                  </li>
                ))}
              </ol>
            )}
          </div>

          <aside className="flex min-w-0 flex-col gap-6">
            <Panel label={t('journal.side.label')}>
              <dl className="flex flex-col gap-3">
                <SideRow
                  label={t('journal.side.status')}
                  value={humaniseToken(journey.status)}
                />
                <SideRow
                  label={t('journal.side.started')}
                  value={
                    formatDate(journey.startedOn, locale) ??
                    t('journal.value.notSet')
                  }
                />
                <SideRow
                  label={t('journal.side.ended')}
                  value={
                    formatDate(journey.endedOn, locale) ??
                    t('journal.value.notSet')
                  }
                />
                <SideRow
                  label={t('journal.side.loosePhotos')}
                  value={formatNumber(data.unattachedPhotos, locale)}
                />
              </dl>
            </Panel>

            {data.moods.length === 0 ? null : (
              <Panel
                label={t('journal.moods.label')}
                count={formatNumber(data.moods.length, locale)}
              >
                <ul className="flex flex-wrap gap-2">
                  {data.moods.map((mood) => (
                    <li
                      key={mood.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-caption text-ink-2"
                    >
                      <span aria-hidden>{mood.emoji}</span>
                      {mood.label}
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            {data.people.length === 0 ? null : (
              <Panel
                label={t('journal.authors.label')}
                count={t('journal.authors.count', {
                  count: data.people.length,
                  authors: formatNumber(data.people.length, locale),
                })}
              >
                <ul className="flex flex-col gap-2.5">
                  {data.people.map((person) => (
                    <li
                      key={person.userId}
                      className="flex items-center gap-2.5"
                    >
                      <Avatar name={person.name} src={person.image} size="sm" />
                      <span className="min-w-0 truncate text-caption text-ink-2">
                        {person.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </aside>
        </div>
      </AppSections>
    </AppFrame>
  )
}

function CoverFigure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="mb-1 text-micro font-semibold tracking-label uppercase text-inverse-muted">
        {label}
      </dt>
      <dd className="truncate font-display text-subtitle font-bold tabular-nums text-inverse-on">
        {value}
      </dd>
    </div>
  )
}

function SideRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-label text-ink-3">{label}</dt>
      <dd className="text-label font-semibold tabular-nums text-ink">
        {value}
      </dd>
    </div>
  )
}

function EntryCard({
  entry,
  data,
}: {
  entry: JourneyEntryCard
  data: JourneyStoryPayload
}) {
  const t = useTranslate()
  const locale = useLocale()
  const author = data.people.find(
    (person) => person.userId === entry.authorUserId,
  )

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-edge-faint bg-surface-2/60 px-5 py-3">
        <span className="flex flex-col items-center justify-center rounded-md bg-inverse px-2.5 py-1 text-inverse-on">
          <span className="font-display text-label leading-none font-bold tabular-nums">
            {entry.entryDate.slice(8, 10)}
          </span>
          <span className="text-micro font-semibold tracking-label uppercase">
            {formatDate(entry.entryDate, locale)?.split(' ')[1] ?? ''}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-label font-semibold text-ink">
            {entry.title ?? humaniseToken(entry.type)}
          </h2>
          <p className="truncate text-caption text-ink-3">
            {[
              formatDate(entry.entryDate, locale),
              formatTime(entry.entryTime),
              entry.locationName,
              author?.name,
            ]
              .filter(
                (part) => part !== null && part !== undefined && part !== '',
              )
              .join(' · ')}
          </p>
        </div>
        {entry.mood === null ? null : (
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-caption text-ink-2"
            style={{ borderColor: entry.mood.colour, borderWidth: '1px' }}
          >
            <span aria-hidden>{entry.mood.emoji}</span>
            {entry.mood.label}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4 p-5">
        {entry.body === null ? null : (
          <p className="text-body leading-relaxed whitespace-pre-line text-ink-2">
            {entry.body}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {entry.locationName === null ? null : (
            <span className="inline-flex items-center gap-1.5 text-caption text-ink-3">
              <MapPin aria-hidden className="size-3.5 text-ink-4" />
              {entry.locationName}
            </span>
          )}
          {entry.weather === null ? null : (
            <span className="inline-flex items-center gap-1.5 text-caption text-ink-3">
              <CloudSun aria-hidden className="size-3.5 text-ink-4" />
              {entry.weather}
            </span>
          )}
          {entry.temperatureCelsius === null ? null : (
            <span className="inline-flex items-center gap-1.5 text-caption tabular-nums text-ink-3">
              <Thermometer aria-hidden className="size-3.5 text-ink-4" />
              {Math.round(entry.temperatureCelsius)}°C
            </span>
          )}
          {entry.photos.length === 0 ? null : (
            <span className="inline-flex items-center gap-1.5 text-caption tabular-nums text-ink-3">
              <Camera aria-hidden className="size-3.5 text-ink-4" />
              {t('journal.entry.photos.count', {
                count: entry.photos.length,
                photos: formatNumber(entry.photos.length, locale),
              })}
            </span>
          )}
        </div>

        {entry.tags.length === 0 ? null : (
          <ul className="flex flex-wrap gap-1.5">
            {entry.tags.map((tag) => (
              <li key={tag}>
                <Badge tone="outline" size="sm">
                  {tag}
                </Badge>
              </li>
            ))}
          </ul>
        )}

        {entry.photos.length === 0 ? null : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {entry.photos.map((photo) => (
              <li
                key={photo.id}
                className="flex aspect-4/3 min-w-0 flex-col justify-end rounded-md bg-surface-inset p-2"
              >
                <span className="inline-flex items-center gap-1.5 truncate text-caption text-ink-3">
                  <Camera
                    aria-hidden
                    className="size-3.5 shrink-0 text-ink-4"
                  />
                  {photo.caption ?? t('journal.photo.untitled')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

function StoryPending() {
  const t = useTranslate()

  return (
    <AppFrame>
      <AppSections>
        <Card variant="inverse" className="space-y-5">
          <span className="sr-only">{t('journal.story.loading')}</span>
          <Skeleton className="h-3 w-24 bg-inverse-surface" radius="sm" />
          <Skeleton className="h-12 w-3/5 bg-inverse-surface" radius="sm" />
          <Skeleton className="h-3 w-2/5 bg-inverse-surface" radius="sm" />
        </Card>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-8">
          <div className="flex flex-col gap-5">
            {Array.from({ length: 3 }, (_, index) => (
              <Card key={index} className="space-y-3">
                <Skeleton className="h-4 w-2/5" radius="sm" />
                <Skeleton className="h-3 w-full" radius="sm" />
                <Skeleton className="h-3 w-11/12" radius="sm" />
                <Skeleton className="h-3 w-3/5" radius="sm" />
              </Card>
            ))}
          </div>
          <HeaderSkeleton />
        </div>
      </AppSections>
    </AppFrame>
  )
}
