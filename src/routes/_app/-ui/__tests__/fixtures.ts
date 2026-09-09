import type { TripCard } from '../../-server/overview'

/**
 * One tile's worth of payload, as `toTripCard` builds it.
 *
 * A factory rather than a shared constant: three suites render this trip in three states, and a
 * frozen object one of them mutates is the kind of coupling that fails the *other* two.
 */
export function tripCard(patch: Partial<TripCard> = {}): TripCard {
  return {
    id: 'trip-1',
    title: 'Lisbon in April',
    slug: 'lisbon-in-april',
    summary: null,
    destination: 'Lisbon',
    status: 'planning',
    startDate: '2026-04-01',
    endDate: '2026-04-10',
    currency: 'EUR',
    countryCodes: ['PT'],
    coverImageUrl: null,
    accentColour: null,
    isFavourite: false,
    isArchived: false,
    copyPending: false,
    placeCount: 12,
    updatedAt: '2026-03-01T00:00:00.000Z',
    role: 'owner',
    ...patch,
  }
}
