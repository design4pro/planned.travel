import { Link, createFileRoute } from '@tanstack/react-router'
import {
  BookOpen,
  Camera,
  Compass,
  Milestone,
  NotebookPen,
  Quote,
} from 'lucide-react'

import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { PageHeader } from '#/components/layout/page-header'
import {
  Badge,
  Card,
  EmptyState,
  StatCard,
  transitionBase,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import {
  loadJournalOverview,
  loadJourneyTripOptions,
  loadJourneys,
} from '../-server/library'
import {
  daysUntil,
  formatDate,
  formatDateRange,
  formatNumber,
  humaniseToken,
  pluralise,
} from '../-lib/format'
import { JOURNEY_STATUS_TONE, TRIP_STATUS_TONE, toneFor } from '../-lib/tone'
import { CoverArt, seedFrom } from '../-ui/cover-art'
import { NewJourneyDialog } from '../-ui/create-dialogs'
import {
  CardsSkeleton,
  HeaderSkeleton,
  Panel,
  PanelRow,
  RowsSkeleton,
  StatsSkeleton,
} from '../-ui/scaffold'
import { AddTile } from '../-ui/trip-card'

import type { JournalOverview, JourneyCard } from '../-server/library'

/**
 * Cover washes, so a journal without a photograph still has a face.
 *
 * Tinted tokens, not an alpha of the full hue: the tints are declared per theme,
 * where `brand/40` over charcoal is whatever the blend happens to produce. The
 * paired monogram class carries the same hue at a decorative weight.
 */
interface JourneyCover {
  readonly wash: string
  readonly ink: string
}

const COVERS: ReadonlyArray<JourneyCover> = [
  { wash: 'from-brand-subtle via-brand-subtle/45', ink: 'text-brand/35' },
  { wash: 'from-warning-soft via-warning-soft/45', ink: 'text-warning/35' },
  { wash: 'from-info-soft via-info-soft/45', ink: 'text-info/35' },
  { wash: 'from-success-soft via-success-soft/45', ink: 'text-success/35' },
  { wash: 'from-danger-soft via-danger-soft/45', ink: 'text-danger/30' },
  { wash: 'from-accent-subtle via-accent-subtle/45', ink: 'text-ink-3/40' },
]

function coverFor(id: string): JourneyCover {
  return (
    COVERS.at(seedFrom(id) % COVERS.length) ?? {
      wash: 'from-surface-2 via-surface-2/45',
      ink: 'text-ink/15',
    }
  )
}

/** The glyph an entry gets when the writer recorded no mood for that day. */
const ENTRY_ICON: Partial<Record<string, typeof BookOpen>> = {
  milestone: Milestone,
  quote: Quote,
  photo: Camera,
  place: Compass,
}

export const Route = createFileRoute('/_app/journey/')({
  loader: async () => {
    // Three independent reads: the covers, the picker's trip options and
    // everything the page says about what is actually written.
    const [journeys, tripOptions, overview] = await Promise.all([
      loadJourneys(),
      loadJourneyTripOptions(),
      loadJournalOverview(),
    ])
    return { ...journeys, ...tripOptions, overview }
  },
  pendingComponent: JourneysPending,
  errorComponent: ({ error }) => (
    <AppFrame>
      <ErrorPanel error={error} title="Your journal did not load" />
    </AppFrame>
  ),
  component: JourneysPage,
})

/**
 * The journal index.
 *
 * A wall of covers is what a journal looks like from the outside, and on a workspace
 * with two journeys it is also most of a blank page. So the covers are only the first
 * band: above them the four figures that say how much of the travelling has actually
 * been written down, and below them the three questions a journal keeper asks —
 * *what did I last write*, *how did the days feel*, and *which trip is still
 * silent*. All of it is drawn from entries, moods and trips that exist; a workspace
 * with nothing written says so in that shape rather than being padded out.
 */
function JourneysPage() {
  const data = Route.useLoaderData()
  const { overview } = data

  const published = data.journeys.filter(
    (row) => row.status === 'published',
  ).length
  const drafts = data.journeys.length - published
  const entries = data.journeys.reduce(
    (total, row) => total + row.entryCount,
    0,
  )
  const photos = data.journeys.reduce((total, row) => total + row.photoCount, 0)
  // The journeys the photographs are actually *in*, not the journeys that exist:
  // two photographs in one of two journals are not "across two journeys".
  const illustrated = data.journeys.filter((row) => row.photoCount > 0).length
  const lastWritten = overview.recent.at(0)?.entryDate ?? null
  const unwrittenTrips = Math.max(
    overview.coverage.trips - overview.coverage.written,
    0,
  )

  /**
   * Every trip a prompt can name, folded into the picker's options.
   *
   * The picker is otherwise the finished trips; the prompts also offer the trip you
   * are on right now, and a dialog that cannot select the trip its own button named
   * would be a dead end.
   */
  const tripOptions = [
    ...data.trips,
    ...overview.unwritten.filter(
      (trip) => !data.trips.some((entry) => entry.id === trip.id),
    ),
  ]

  return (
    <AppFrame>
      <AppSections>
        <PageHeader
          eyebrow="Travel journal"
          title="Journey"
          description={
            data.journeys.length === 0
              ? 'Turn your trips into stories you will actually re-read'
              : `${pluralise(data.journeys.length, 'journey')} · ${pluralise(entries, 'entry', 'entries')} · ${formatNumber(published)} published`
          }
          actions={<NewJourneyDialog trips={tripOptions} />}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            tone="inverse"
            icon={<BookOpen />}
            label="Entries written"
            value={entries}
            caption={
              lastWritten === null
                ? 'Nothing written yet'
                : `Last written ${formatDate(lastWritten) ?? lastWritten}`
            }
          />
          <StatCard
            icon={<NotebookPen />}
            label="Journeys"
            value={data.journeys.length}
            caption={
              data.journeys.length === 0
                ? 'Start one from any trip'
                : `${formatNumber(published)} published · ${formatNumber(drafts)} in draft`
            }
          />
          <StatCard
            icon={<Compass />}
            label="Trips written up"
            value={overview.coverage.written}
            unit={`of ${formatNumber(overview.coverage.trips)}`}
            caption={
              overview.coverage.trips === 0
                ? 'No trips to write about yet'
                : unwrittenTrips === 0
                  ? 'Every trip has its story'
                  : `${pluralise(unwrittenTrips, 'trip')} still unwritten`
            }
          />
          <StatCard
            icon={<Camera />}
            label="Photographs"
            value={photos}
            caption={
              photos === 0
                ? 'Attach photos to any entry'
                : `Across ${pluralise(illustrated, 'journey')}`
            }
          />
        </div>

        {data.journeys.length === 0 ? (
          <Card variant="dashed" padding="none">
            <EmptyState
              size="lg"
              tone="brand"
              icon={<NotebookPen />}
              title="No journeys yet"
              description="A journey is where a trip becomes a story: entries in date order, the photographs you took, the weather, and how the day actually felt."
              action={<NewJourneyDialog trips={tripOptions} size="md" />}
            />
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.journeys.map((journey) => (
              <li key={journey.id} className="min-w-0">
                <JourneyTile journey={journey} />
              </li>
            ))}
            {/* Closes the row two journals leave open, and puts the next thing
                to do where the eye already is. */}
            <li className="min-w-0">
              <AddTile
                icon={<NotebookPen />}
                title="Write the next one"
                description="Pick a trip and turn its days into entries, with the photographs and the weather already attached."
                action={<NewJourneyDialog trips={tripOptions} size="md" />}
              />
            </li>
          </ul>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
          <LatestEntries recent={overview.recent} />

          <div className="flex min-w-0 flex-col gap-6">
            <Moods moods={overview.moods} entries={entries} />
            <Unwritten
              trips={overview.unwritten}
              tripOptions={tripOptions}
              coverage={overview.coverage}
              today={overview.today}
            />
          </div>
        </div>
      </AppSections>
    </AppFrame>
  )
}

/* -------------------------------------------------------------------------------------------------
 * Latest entries
 * ---------------------------------------------------------------------------------------------- */

function LatestEntries({ recent }: { recent: JournalOverview['recent'] }) {
  return (
    <Panel
      label="Latest entries"
      count={recent.length === 0 ? undefined : formatNumber(recent.length)}
      flush
    >
      {recent.length === 0 ? (
        <div className="px-5 py-10">
          <EmptyState
            tone="brand"
            icon={<BookOpen />}
            title="Nothing written yet"
            description="An entry is one day of a trip: what you did, where you were, how it felt. Open a journey and write the first one — the rest of the page fills in from there."
          />
        </div>
      ) : (
        <ul>
          {recent.map((entry) => {
            const Glyph = ENTRY_ICON[entry.type] ?? BookOpen
            const heading = entry.title ?? `${humaniseToken(entry.type)} entry`

            return (
              <li
                key={entry.id}
                className="not-last:border-b not-last:border-edge-faint"
              >
                <Link
                  to="/journey/$journeyId"
                  params={{ journeyId: entry.journeyId }}
                  className={cn(
                    'flex min-w-0 items-start gap-3.5 px-5 py-3.5',
                    'hover:bg-hover focus-ring',
                    transitionBase,
                  )}
                >
                  {/* A mood's colour is stored on its row, so it is data and has
                      to be applied inline. Mixed rather than alpha-appended: the
                      stored value may be any legal hex, and `#abc` + `1f` is not
                      a colour. */}
                  <span
                    aria-hidden
                    style={
                      entry.mood === null
                        ? undefined
                        : {
                            backgroundColor: `color-mix(in oklab, ${entry.mood.colour} 14%, transparent)`,
                          }
                    }
                    className={cn(
                      'grid size-9 shrink-0 place-items-center rounded-lg text-label',
                      entry.mood === null && 'bg-surface-2 text-ink-3',
                    )}
                  >
                    {entry.mood === null ? (
                      <Glyph aria-hidden className="size-4" />
                    ) : (
                      entry.mood.emoji
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-baseline justify-between gap-3">
                      <span className="truncate text-label font-semibold text-ink">
                        {heading}
                      </span>
                      <span className="shrink-0 text-caption tabular-nums text-ink-4">
                        {formatDate(entry.entryDate)}
                      </span>
                    </span>

                    {entry.excerpt === null ? null : (
                      <span className="mt-0.5 line-clamp-2 block text-caption leading-relaxed text-ink-3">
                        {entry.excerpt}
                      </span>
                    )}

                    <span className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-caption text-ink-4">
                      <span className="truncate font-medium text-ink-3">
                        {entry.journeyTitle}
                      </span>
                      {entry.locationName === null ? null : (
                        <span className="truncate">{entry.locationName}</span>
                      )}
                      {entry.mood === null ? null : (
                        <span>{entry.mood.label}</span>
                      )}
                      {entry.photoCount === 0 ? null : (
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Camera aria-hidden className="size-3" />
                          {formatNumber(entry.photoCount)}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

/* -------------------------------------------------------------------------------------------------
 * Moods
 * ---------------------------------------------------------------------------------------------- */

function Moods({
  moods,
  entries,
}: {
  moods: JournalOverview['moods']
  entries: number
}) {
  const busiest = Math.max(...moods.map((mood) => mood.count), 1)
  const recorded = moods.reduce((total, mood) => total + mood.count, 0)

  return (
    <Panel
      label="How the days felt"
      count={
        recorded === 0
          ? undefined
          : `${formatNumber(recorded)} of ${formatNumber(entries)}`
      }
    >
      {moods.length === 0 ? (
        <p className="text-caption leading-relaxed text-ink-3">
          Give an entry a mood — awed, calm, weary — and the journal starts
          keeping the shape of the trip as well as its facts.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {moods.map((mood) => (
            <li key={mood.label}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-caption font-medium text-ink-2">
                  <span aria-hidden className="mr-1.5">
                    {mood.emoji}
                  </span>
                  {mood.label}
                </span>
                <span className="shrink-0 text-caption tabular-nums text-ink-4">
                  {pluralise(mood.count, 'entry', 'entries')}
                </span>
              </div>
              <div
                aria-hidden
                className="h-1.5 overflow-hidden rounded-full bg-surface-inset"
              >
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.round((mood.count / busiest) * 100)}%`,
                    backgroundColor: mood.colour,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/* -------------------------------------------------------------------------------------------------
 * Trips with no story yet
 * ---------------------------------------------------------------------------------------------- */

/** Why this trip is the next one to write: "ended 62 days ago", "happening now". */
function whenFor(
  trip: JournalOverview['unwritten'][number],
  today: string,
): string {
  const ended = daysUntil(trip.endDate, today)
  const starts = daysUntil(trip.startDate, today)

  if (ended !== null && ended < 0) {
    const days = Math.abs(ended)
    return days === 1 ? 'Ended yesterday' : `Ended ${days} days ago`
  }
  if (starts !== null && starts <= 0) return 'Happening now'
  if (starts !== null) {
    return starts === 1 ? 'Starts tomorrow' : `Starts in ${starts} days`
  }
  return 'No dates yet'
}

function Unwritten({
  trips,
  tripOptions,
  coverage,
  today,
}: {
  trips: JournalOverview['unwritten']
  tripOptions: ReadonlyArray<{ readonly id: string; readonly title: string }>
  coverage: JournalOverview['coverage']
  today: string
}) {
  return (
    <Panel
      label="Waiting for a story"
      count={
        trips.length === 0
          ? undefined
          : formatNumber(
              Math.max(coverage.trips - coverage.written, trips.length),
            )
      }
      flush
    >
      {trips.length === 0 ? (
        <div className="px-5 py-6">
          <p className="text-caption leading-relaxed text-ink-3">
            {coverage.trips === 0
              ? 'Plan a trip and it appears here the moment it needs writing up.'
              : 'Every trip in this workspace has a journey attached. Nothing is waiting.'}
          </p>
        </div>
      ) : (
        <ul>
          {trips.map((trip) => (
            <li key={trip.id}>
              <PanelRow className="items-start gap-3">
                <span className="min-w-0 flex-1">
                  <Link
                    to="/trips/$tripId"
                    params={{ tripId: trip.id }}
                    className="block truncate rounded-sm text-label font-semibold text-ink hover:text-brand focus-ring"
                  >
                    {trip.title}
                  </Link>
                  <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-4">
                    <Badge
                      tone={toneFor(TRIP_STATUS_TONE, trip.status)}
                      size="sm"
                    >
                      {humaniseToken(trip.status)}
                    </Badge>
                    <span className="tabular-nums">
                      {formatDateRange(trip.startDate, trip.endDate) ??
                        'Dates not set'}
                    </span>
                  </span>
                  <span className="mt-1 block text-caption text-ink-4">
                    {whenFor(trip, today)}
                  </span>
                </span>
                <NewJourneyDialog
                  trips={tripOptions}
                  trip={trip}
                  label="Write it up"
                  variant="secondary"
                />
              </PanelRow>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/* -------------------------------------------------------------------------------------------------
 * Cover tile
 * ---------------------------------------------------------------------------------------------- */

function JourneyTile({ journey }: { journey: JourneyCard }) {
  const range = formatDateRange(journey.startedOn, journey.endedOn)
  const cover = coverFor(journey.id)

  return (
    <Card asChild interactive padding="none" className="h-full overflow-hidden">
      <Link
        to="/journey/$journeyId"
        params={{ journeyId: journey.id }}
        className="flex h-full flex-col focus-ring"
      >
        <div className="relative h-32 shrink-0 overflow-hidden bg-surface-2">
          {journey.coverImageUrl === null ? (
            <CoverArt id={journey.id} wash={cover.wash} ink={cover.ink} />
          ) : (
            <img
              src={journey.coverImageUrl}
              alt=""
              className="size-full object-cover"
            />
          )}
          <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            <Badge
              tone={toneFor(JOURNEY_STATUS_TONE, journey.status)}
              size="sm"
            >
              {humaniseToken(journey.status)}
            </Badge>
            {journey.photoCount === 0 ? null : (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface/85 px-2 py-0.5 text-caption font-semibold tabular-nums text-ink-2 backdrop-blur-sm">
                <Camera aria-hidden className="size-3" />
                {formatNumber(journey.photoCount)}
              </span>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2 p-5">
          <h2 className="truncate font-display text-subtitle font-bold tracking-tight text-ink">
            {journey.title}
          </h2>
          {journey.subtitle === null ? null : (
            <p className="line-clamp-2 text-caption leading-relaxed text-ink-3">
              {journey.subtitle}
            </p>
          )}
          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 text-caption text-ink-3">
            <span className="inline-flex items-center gap-1.5">
              <BookOpen aria-hidden className="size-3.5 text-ink-4" />
              <span className="tabular-nums">
                {pluralise(journey.entryCount, 'entry', 'entries')}
              </span>
            </span>
            <span className="tabular-nums">{range ?? 'Dates not set'}</span>
          </div>
        </div>
      </Link>
    </Card>
  )
}

function JourneysPending() {
  return (
    <AppFrame>
      <AppSections>
        <HeaderSkeleton />
        <StatsSkeleton tiles={4} />
        <CardsSkeleton cards={3} />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
          <RowsSkeleton rows={5} />
          <RowsSkeleton rows={3} />
        </div>
      </AppSections>
    </AppFrame>
  )
}
