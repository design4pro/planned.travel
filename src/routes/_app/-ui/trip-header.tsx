/**
 * Shared furniture for the seven tabs inside a trip.
 *
 * `useTripHeader` reads the parent route's loader data, which is why a tab never
 * re-fetches the trip it already sits inside.
 */
import { useLoaderData } from '@tanstack/react-router'

import { useLocale } from '#/lib/i18n'
import { AvatarStack, Badge } from '#/components/ui'
import { PageHeader } from '#/components/layout/page-header'
import {
  daysBetween,
  formatDateRange,
  humaniseToken,
  pluralise,
} from '../-lib/format'
import { TRIP_STATUS_TONE, toneFor } from '../-lib/tone'

import type { ReactNode } from 'react'
import type { TripHeaderPayload } from '../-server/trip'

export function useTripHeader(): TripHeaderPayload {
  return useLoaderData({ from: '/_app/trips/$tripId' })
}

export interface TripModuleHeaderProps {
  /** The module's own name — "Costs", "Bookings", "Lists". */
  title: string
  /** A short factual line: counts, totals, progress. */
  description?: string
  actions?: ReactNode
  /** Filters or a toolbar under the title row. */
  children?: ReactNode
}

/**
 * Every trip tab opens with the same band: the module name, one factual line,
 * the trip's dates and travellers, and the module's own actions.
 */
export function TripModuleHeader({
  title,
  description,
  actions,
  children,
}: TripModuleHeaderProps) {
  const locale = useLocale()
  const { trip, people, dayCount } = useTripHeader()
  const range = formatDateRange(trip.startDate, trip.endDate, locale)
  const length = daysBetween(trip.startDate, trip.endDate)

  return (
    <PageHeader title={title} description={description} actions={actions}>
      <div className="flex flex-wrap items-center gap-2.5">
        <Badge tone={toneFor(TRIP_STATUS_TONE, trip.status)} size="lg">
          {humaniseToken(trip.status)}
        </Badge>
        <span className="inline-flex h-7 items-center rounded-full bg-surface-2 px-3 text-caption font-medium tabular-nums text-ink-2">
          {range ?? 'Dates not set'}
          {length === null ? '' : ` · ${pluralise(length, 'day')}`}
        </span>
        <span className="inline-flex h-7 items-center rounded-full bg-surface-2 px-3 text-caption font-medium tabular-nums text-ink-2">
          {pluralise(dayCount, 'day')} planned
        </span>
        {people.length === 0 ? null : (
          <AvatarStack
            className="ms-1"
            size="sm"
            people={people.map((person) => ({
              id: person.userId,
              name: person.name,
              src: person.image,
            }))}
            label={pluralise(people.length, 'traveller')}
          />
        )}
        {children}
      </div>
    </PageHeader>
  )
}

/** Resolves a user id to a display name using the trip's traveller list. */
export function nameFor(
  people: ReadonlyArray<{ userId: string; name: string }>,
  userId: string | null,
): string {
  if (userId === null) {
    return 'Unassigned'
  }
  return (
    people.find((person) => person.userId === userId)?.name ??
    'Removed traveller'
  )
}
