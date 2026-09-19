/**
 * The trip index's list mode (`01-S7`): one dense row per trip.
 *
 * Not a narrow tile. The grid is for browsing, so it leads with cover art; the list is for looking
 * something up, so it leads with what a vertical scan reads — the title, the dates, the status and
 * how many people are going — and ends with the same action menu the tile carries. The archived
 * fold at the foot of the index is drawn with these rows too.
 */
import { Link } from '@tanstack/react-router'
import { CalendarDays, Star, Users } from 'lucide-react'

import { Badge, Card, Spinner } from '#/components/ui'
import { cn } from '#/lib/cn'
import { useLocale, useTranslate } from '#/lib/i18n'
import { TripActionsMenu, useTripFavourite } from './trip-actions'
import { formatDateRange, formatNumber } from '../-lib/format'
import { TRIP_STATUS_LABEL, TRIP_STATUS_TONE, toneFor } from '../-lib/tone'

import type { TripCard } from '../-server/overview'

/** Past eight rows the last one is waiting on the list rather than the list on the reader. */
const STAGGER_CAP = 7
const STAGGER_MS = 24

export function TripListRow({
  trip,
  titleAs: Title = 'h3',
}: {
  trip: TripCard
  /** Where the title sits in the page outline — see `TripTile`. */
  titleAs?: 'h2' | 'h3'
}) {
  const locale = useLocale()
  const t = useTranslate()
  const favourite = useTripFavourite(trip)
  const range = formatDateRange(trip.startDate, trip.endDate, locale)
  const copying = trip.copyPending

  return (
    <div
      data-part="trip-row"
      aria-busy={copying ? true : undefined}
      className={cn(
        'group relative flex min-h-16 items-center gap-3 px-4 py-3',
        'transition-colors duration-fast ease-out-quint',
        !copying && 'hover:bg-surface-2 focus-within:bg-surface-2',
      )}
    >
      <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_auto_minmax(3.5rem,auto)]">
        <div className="min-w-0">
          <Title className="truncate text-label font-semibold text-ink">
            {copying ? (
              trip.title
            ) : (
              /* The whole row answers the click, through the link's own box stretched over it —
                 the menu is lifted above that box, so the two stay siblings rather than a button
                 inside an anchor. */
              <Link
                to="/trips/$tripId/plan"
                params={{ tripId: trip.id }}
                className="rounded-sm focus-ring after:absolute after:inset-0"
              >
                {trip.title}
              </Link>
            )}
          </Title>
          <p className="truncate text-caption text-ink-3">
            {trip.destination ??
              trip.summary ??
              t('shell.trips.card.noDestination')}
          </p>
        </div>

        <span className="col-start-1 flex min-w-0 items-center gap-1.5 text-caption text-ink-3 md:col-start-auto">
          <CalendarDays aria-hidden className="size-3.5 shrink-0 text-ink-4" />
          <span className="truncate tabular-nums">
            {range ?? t('shell.trips.card.noDates')}
          </span>
        </span>

        <span className="col-start-2 row-start-1 justify-self-end md:col-start-auto md:row-start-auto md:justify-self-start">
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
        </span>

        <span className="col-start-2 row-start-2 flex items-center justify-self-end gap-1.5 text-caption text-ink-3 md:col-start-auto md:row-start-auto md:justify-self-start">
          <Users aria-hidden className="size-3.5 shrink-0 text-ink-4" />
          <span className="sr-only">
            {t('shell.dashboard.hero.travellers')}
          </span>
          <span className="tabular-nums">
            {formatNumber(trip.peopleCount, locale)}
          </span>
        </span>
      </div>

      <div className="relative z-10 flex shrink-0 items-center gap-1.5">
        {favourite.starred ? (
          <span
            role="img"
            aria-label={t('shell.trips.card.favourite')}
            className="flex size-6 items-center justify-center text-warning"
          >
            <Star aria-hidden className="size-3.5 fill-current" />
          </span>
        ) : null}
        <TripActionsMenu trip={trip} favourite={favourite} />
      </div>
    </div>
  )
}

/**
 * A card of rows. Each row rises in on its own, 24ms after the one above it and capped at eight, so
 * switching into list mode reads as the list arriving rather than as a box swapping shape.
 */
export function TripList({
  trips,
  titleAs,
  className,
}: {
  trips: ReadonlyArray<TripCard>
  titleAs?: 'h2' | 'h3'
  className?: string
}) {
  return (
    <Card padding="none" className={cn('overflow-hidden', className)}>
      <ul className="flex flex-col">
        {trips.map((trip, index) => (
          <li
            key={trip.id}
            data-motion-transform=""
            className="min-w-0 animate-rise not-last:border-b not-last:border-edge-faint"
            style={{
              animationDelay: `${Math.min(index, STAGGER_CAP) * STAGGER_MS}ms`,
            }}
          >
            <TripListRow trip={trip} titleAs={titleAs} />
          </li>
        ))}
      </ul>
    </Card>
  )
}
