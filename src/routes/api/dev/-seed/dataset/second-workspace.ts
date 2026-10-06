/**
 * The second workspace the demo owner belongs to, so the workspace switcher has somewhere to go.
 *
 * Deliberately minimal: an organization, the demo owner as its owner, and one trip. It is not part
 * of `trips` in `./index.ts` - those six are the first workspace's world, every recorded screenshot
 * of `/trips` and `/dashboard` is a photograph of them, and a seventh there would repaint it. What
 * this trip has to be is *distinguishable*: its title appears nowhere in the first workspace, so a
 * journey that switches over can assert the first workspace's trips are gone and this one is not.
 *
 * It carries no subscription row, which is what a workspace nobody has paid for looks like (the
 * free plan, one seat, two trips).
 */

import { day } from './anchor'
import type { SeedTrip } from '../types'

export const secondWorkspace = {
  name: 'Wolak Family Trips',
  slug: 'wolak-family-trips',
  trip: {
    // Continues the sequence the first workspace's six trips occupy, after them, so `order by id`
    // still reads the fixture in the order it is written.
    id: 'demo-trip-07-sopot-family-weekend',
    slug: 'sopot-family-weekend',
    title: 'Sopot, a family weekend',
    summary: 'Two nights by the Baltic with the cousins, pier at sunrise.',
    destination: 'Sopot, Poland',
    countryCodes: ['PL'],
    startDate: day(21),
    endDate: day(23),
    timezone: 'Europe/Warsaw',
    currency: 'PLN',
    status: 'planning',
    visibility: 'organization',
    accentColour: '#2f6f8f',
  } satisfies Pick<
    SeedTrip,
    | 'id'
    | 'slug'
    | 'title'
    | 'summary'
    | 'destination'
    | 'countryCodes'
    | 'startDate'
    | 'endDate'
    | 'timezone'
    | 'currency'
    | 'status'
    | 'visibility'
    | 'accentColour'
  >,
} as const
