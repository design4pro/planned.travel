/**
 * The trip tile, used by the dashboard and by the trip index.
 *
 * One definition so the two screens can never drift: same cover treatment,
 * same status badge, same date line, same hover lift.
 */
import { useState } from 'react'
import type * as React from 'react'
import { Link } from '@tanstack/react-router'
import { CalendarDays, MapPin, Star } from 'lucide-react'

import { Badge, Card, Skeleton, Spinner } from '#/components/ui'
import { cn } from '#/lib/cn'
import { useLocale, useTranslate } from '#/lib/i18n'
import { CoverArt, seedFrom } from './cover-art'
import { TripActionsMenu, useTripFavourite } from './trip-actions'
import {
  countryFlag,
  daysBetween,
  daysUntil,
  formatDateRange,
  formatNumber,
} from '../-lib/format'
import { TRIP_STATUS_LABEL, TRIP_STATUS_TONE, toneFor } from '../-lib/tone'

import type { TripCard } from '../-server/overview'

/**
 * Deterministic cover wash when a trip has no photograph of its own.
 *
 * Built from the tinted `-soft`/`-subtle` tokens rather than from an alpha of the
 * full hue: a `warning/30` wash is warm sand over paper and olive sludge over
 * charcoal, because alpha knows nothing about the ground underneath it. The
 * tinted tokens are declared per theme, so both themes get a tint that was
 * chosen rather than one that fell out of a blend.
 */
interface CoverWash {
  readonly wash: string
  readonly ink: string
}

const COVER_WASHES: ReadonlyArray<CoverWash> = [
  { wash: 'from-brand-subtle via-brand-subtle/45', ink: 'text-brand/35' },
  { wash: 'from-warning-soft via-warning-soft/45', ink: 'text-warning/35' },
  { wash: 'from-info-soft via-info-soft/45', ink: 'text-info/35' },
  { wash: 'from-success-soft via-success-soft/45', ink: 'text-success/35' },
  { wash: 'from-danger-soft via-danger-soft/45', ink: 'text-danger/30' },
  { wash: 'from-accent-subtle via-accent-subtle/45', ink: 'text-ink-3/40' },
]

const FALLBACK_WASH: CoverWash = {
  wash: 'from-surface-2 via-surface-2/45',
  ink: 'text-ink/15',
}

function washFor(id: string): CoverWash {
  return COVER_WASHES.at(seedFrom(id) % COVER_WASHES.length) ?? FALLBACK_WASH
}

/**
 * One wash per trip, and no two the same in a grid that fits them all.
 *
 * Seeding straight off the id is stable, which is what a cover needs, but with six
 * washes and five trips a collision is the *likely* outcome rather than the
 * unlucky one — and two cards in the same grid drawn in the same neutral grey read
 * as a broken image, not as a palette. So the seed still chooses, and a trip whose
 * choice is already taken walks forward to the next free one.
 *
 * Deterministic, because the walk runs over the list in render order: the same
 * trips in the same order always get the same covers. The trade is that a cover
 * depends on the set it is shown in, which is the right way round — nobody
 * compares a tile against a tile they cannot see, and everybody notices two
 * identical tiles side by side.
 */
function washesFor(
  trips: ReadonlyArray<{ readonly id: string }>,
): ReadonlyArray<CoverWash> {
  const taken = new Set<number>()
  return trips.map((trip) => {
    const first = seedFrom(trip.id) % COVER_WASHES.length
    let index = first
    // Only ever wraps once, and only while a free wash remains; past that every
    // wash is in use and repeating is no longer avoidable.
    for (let step = 0; step < COVER_WASHES.length; step += 1) {
      index = (first + step) % COVER_WASHES.length
      if (!taken.has(index)) break
    }
    taken.add(index)
    if (taken.size === COVER_WASHES.length) taken.clear()
    return COVER_WASHES.at(index) ?? FALLBACK_WASH
  })
}

/**
 * The tile's picture: the trip's cover, or the shipped cover art when it has none or the cover
 * cannot be loaded (the object is gone, or the reader's session ended), so a tile never shows a
 * broken image.
 */
function TileCover({
  id,
  url,
  wash,
  ink,
}: {
  id: string
  url: string | null
  wash: string
  ink: string
}) {
  const [failed, setFailed] = useState(false)
  if (url === null || failed) {
    return <CoverArt id={id} wash={wash} ink={ink} />
  }
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      className="size-full object-cover"
      onError={() => {
        setFailed(true)
      }}
    />
  )
}

export function TripTile({
  trip,
  today,
  cover = washFor(trip.id),
  titleAs: Title = 'h3',
}: {
  trip: TripCard
  today: string
  /**
   * Overrides the wash this trip's id would pick. The grid passes one so a row
   * cannot show the same cover twice; a lone tile is happy with the default.
   */
  cover?: CoverWash
  /**
   * Where this card's title sits in the page's outline.
   *
   * `h3` by default, which is what a card is on the dashboard: the grid lives
   * under a section already headed "Your trips". On `/trips` the same grid *is*
   * the page under its own `h1`, so there the cards are the second level and a
   * fixed `h3` would skip one.
   */
  titleAs?: 'h2' | 'h3'
}) {
  const locale = useLocale()
  const t = useTranslate()
  /** Held here because the tile renders both of its readers — see {@link useTripFavourite}. */
  const favourite = useTripFavourite(trip)
  const range = formatDateRange(trip.startDate, trip.endDate, locale)
  const length = daysBetween(trip.startDate, trip.endDate)
  const startsIn = daysUntil(trip.startDate, today)
  const copying = trip.copyPending

  /**
   * The tile's third resting state: the `trip-copy` handler has not finished filling this trip in.
   *
   * The cover and the counts are behind a `Skeleton` because they are facts that have not landed
   * yet — a copy shows `0 places` for as long as the handler runs, and a zero is a claim rather
   * than an absence. The tile is deliberately *not* a link either: a trip whose days have not been
   * written is a planner with an empty day list, and handing that to a reader is worse than making
   * them wait for the list to revalidate.
   */
  const body = (
    <>
      <div className="relative h-28 shrink-0 overflow-hidden bg-surface-2">
        {copying ? (
          <Skeleton radius="sm" className="size-full rounded-none" />
        ) : (
          <TileCover
            key={trip.coverImageUrl}
            id={trip.id}
            url={trip.coverImageUrl}
            wash={cover.wash}
            ink={cover.ink}
          />
        )}

        <div className="absolute start-3 top-3 flex items-start gap-2">
          {copying ? (
            <Badge
              tone="brand"
              size="sm"
              icon={<Spinner size="sm" label={null} />}
              aria-label={t('shell.trips.card.copyingLabel', {
                title: trip.title,
              })}
            >
              {t('shell.trips.card.copying')}
            </Badge>
          ) : (
            <Badge tone={toneFor(TRIP_STATUS_TONE, trip.status)} size="sm">
              {t(TRIP_STATUS_LABEL[trip.status] ?? 'shell.tripStatus.draft')}
            </Badge>
          )}
        </div>

        {copying || trip.countryCodes.length === 0 ? null : (
          <span aria-hidden className="absolute bottom-2.5 start-3 text-label">
            {trip.countryCodes.slice(0, 5).map(countryFlag).join(' ')}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <Title className="truncate font-display text-subtitle font-bold tracking-tight text-ink">
          {trip.title}
        </Title>
        <p className="truncate text-caption text-ink-3">
          {trip.destination ??
            trip.summary ??
            t('shell.trips.card.noDestination')}
        </p>

        {copying ? (
          <div className="mt-auto flex items-center gap-4 pt-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3.5 w-10" />
          </div>
        ) : (
          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 text-caption text-ink-3">
            <span className="flex items-center gap-1.5">
              <CalendarDays aria-hidden className="size-3.5 text-ink-4" />
              <span className="tabular-nums">
                {range ?? t('shell.trips.card.noDates')}
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin aria-hidden className="size-3.5 text-ink-4" />
              <span className="tabular-nums">
                {formatNumber(trip.placeCount, locale)}
              </span>
            </span>
            {length === null ? null : (
              <span className="tabular-nums">
                {t('shell.trips.card.days', {
                  days: formatNumber(length, locale),
                })}
              </span>
            )}
            {startsIn === null || startsIn < 0 || startsIn > 60 ? null : (
              <span className="ms-auto rounded-full bg-brand-subtle px-2 py-0.5 font-semibold text-brand tabular-nums">
                {startsIn === 0
                  ? t('shell.dashboard.hero.today')
                  : t('shell.trips.card.startsIn', {
                      days: formatNumber(startsIn, locale),
                    })}
              </span>
            )}
          </div>
        )}
      </div>
    </>
  )

  return (
    /**
     * The card is its own element and the link sits inside it, rather than the link *being* the card.
     * The action menu is a button, and a button inside an anchor is neither valid HTML nor operable:
     * the anchor swallows the click. Keeping the card as the outer element lets the two be siblings
     * while the hover lift still belongs to the whole tile, so the menu does not sit still while the
     * card underneath it moves.
     */
    <Card
      interactive={!copying}
      padding="none"
      className="group flex h-full flex-col overflow-hidden"
      aria-busy={copying ? true : undefined}
      data-part="trip-tile"
    >
      {copying ? (
        <div className="flex h-full flex-col">{body}</div>
      ) : (
        <Link
          to="/trips/$tripId/plan"
          params={{ tripId: trip.id }}
          className="flex h-full flex-col focus-ring"
        >
          {body}
        </Link>
      )}

      {/*
        The corner cluster: the favourite mark and the action menu, side by side and outside the
        link. The mark used to sit inside it, in the same absolute row as the status badge, which
        put it exactly where the menu trigger now goes — two controls stacked on one another. Both
        live here so the trip's own chrome is one row that can never overlap itself.
      */}
      <div className="absolute end-3 top-3 z-10 flex items-start gap-1.5">
        {favourite.starred ? (
          <span
            /* `role="img"` because a bare span is `generic`, which ARIA forbids the author to
               name — the label would be dropped by the readers it is there for. Same answer as
               `components/map/pins.tsx`. */
            role="img"
            aria-label={t('shell.trips.card.favourite')}
            className="flex size-6 items-center justify-center rounded-full bg-surface/85 text-warning backdrop-blur-sm"
          >
            <Star aria-hidden className="size-3.5 fill-current" />
          </span>
        ) : null}
        <TripActionsMenu trip={trip} favourite={favourite} />
      </div>
    </Card>
  )
}

export function TripGrid({
  trips,
  today,
  columns = 3,
  className,
  titleAs,
  trailing,
}: {
  trips: ReadonlyArray<TripCard>
  today: string
  columns?: 2 | 3
  className?: string
  /** Passed to every tile — see `TripTile`. */
  titleAs?: 'h2' | 'h3'
  /**
   * Rendered as the final cell.
   *
   * Four trips in a three-across grid left one tile alone on a row and a
   * viewport-height of empty canvas under it. A call to action in that hole
   * closes the row *and* puts the next thing a reader wants where they are
   * already looking.
   */
  trailing?: React.ReactNode
}) {
  const washes = washesFor(trips)

  return (
    <ul
      className={cn(
        'grid gap-4',
        columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3',
        className,
      )}
    >
      {trips.map((trip, index) => (
        <li key={trip.id} className="min-w-0">
          <TripTile
            trip={trip}
            today={today}
            cover={washes.at(index) ?? FALLBACK_WASH}
            titleAs={titleAs}
          />
        </li>
      ))}
      {trailing === undefined ? null : <li className="min-w-0">{trailing}</li>}
    </ul>
  )
}

/**
 * The dashed "one more" tile that closes a ragged grid row.
 *
 * Sized to match a trip tile rather than to its own content, so the row it
 * completes stays a row of equal cards.
 */
export function AddTile({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action: React.ReactNode
}) {
  return (
    <Card
      variant="dashed"
      padding="none"
      className="flex h-full min-h-52 flex-col items-center justify-center gap-2 p-6 text-center"
    >
      <span
        aria-hidden
        className="grid size-10 place-items-center rounded-full bg-surface-2 text-ink-3 [&_svg]:size-4.5"
      >
        {icon}
      </span>
      <p className="font-display text-subtitle font-bold tracking-tight text-ink">
        {title}
      </p>
      <p className="max-w-56 text-caption text-ink-3">{description}</p>
      <div className="pt-2">{action}</div>
    </Card>
  )
}
