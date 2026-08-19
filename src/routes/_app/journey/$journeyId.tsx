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
import { loadJourneyStory } from '../-server/library'
import {
  formatDate,
  formatDateRange,
  formatNumber,
  formatTime,
  humaniseToken,
  pluralise,
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
  errorComponent: ({ error }) => (
    <AppFrame>
      <ErrorPanel error={error} title="This journey did not load" />
    </AppFrame>
  ),
  component: StoryPage,
})

function StoryPage() {
  const data = Route.useLoaderData()
  const { journey } = data
  const range = formatDateRange(journey.startedOn, journey.endedOn)

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
              className="pointer-events-none absolute -top-32 -right-20 size-80 rounded-full bg-brand/30 blur-3xl"
            />
          ) : (
            <>
              <img
                src={journey.coverImageUrl}
                alt=""
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
                  All journeys
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
                label="Entries"
                value={formatNumber(journey.entryCount)}
              />
              <CoverFigure
                label="Photos"
                value={formatNumber(journey.photoCount)}
              />
              <CoverFigure label="Dates" value={range ?? 'Not set'} />
              <CoverFigure
                label="Visibility"
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
                  title="This journey has no entries yet"
                  description="Each entry is one moment: a date, a few lines, a place and the photographs you took there. Write the first one while you still remember the smell of it."
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
            <Panel label="This journey">
              <dl className="flex flex-col gap-3">
                <SideRow label="Status" value={humaniseToken(journey.status)} />
                <SideRow
                  label="Started"
                  value={formatDate(journey.startedOn) ?? 'Not set'}
                />
                <SideRow
                  label="Ended"
                  value={formatDate(journey.endedOn) ?? 'Not set'}
                />
                <SideRow
                  label="Loose photos"
                  value={formatNumber(data.unattachedPhotos)}
                />
              </dl>
            </Panel>

            {data.moods.length === 0 ? null : (
              <Panel label="Moods" count={formatNumber(data.moods.length)}>
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
                label="Written by"
                count={pluralise(data.people.length, 'author')}
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
          <span className="text-[0.5625rem] leading-tight font-semibold tracking-wide uppercase">
            {formatDate(entry.entryDate)?.split(' ')[1] ?? ''}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-label font-semibold text-ink">
            {entry.title ?? humaniseToken(entry.type)}
          </h2>
          <p className="truncate text-caption text-ink-3">
            {[
              formatDate(entry.entryDate),
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
              {pluralise(entry.photos.length, 'photo')}
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
                  {photo.caption ?? 'Untitled photograph'}
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
  return (
    <AppFrame>
      <AppSections>
        <Card variant="inverse" className="space-y-5">
          <span className="sr-only">Loading</span>
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
