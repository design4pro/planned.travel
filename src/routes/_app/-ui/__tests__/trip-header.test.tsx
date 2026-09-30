import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { I18nProvider } from '#/lib/i18n'
import { createTranslator } from '#/lib/i18n/catalogue'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/pl/costs'
import Modules from '#/lib/i18n/messages/pl/modules'
import Shell from '#/lib/i18n/messages/pl/shell'
import Trips from '#/lib/i18n/messages/pl/trips'
import { TripModuleHeader, nameFor } from '../trip-header'

import type { Catalogue } from '#/lib/i18n'
import type { TripHeaderPayload } from '../../-server/trip'

/**
 * The band renders on all seven trip tabs, so one English word here is English on every tab. The
 * suite reads Polish on purpose: `pl` needs the `few` and `many` branches `en` does not have, which
 * is what `pluralise(n, 'day')` could never produce.
 */
const PL: Catalogue = {
  ...namespaceCatalogue('costs', Costs),
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('trips', Trips),
}
const t = createTranslator('pl', PL)

const header = vi.hoisted(() => ({ payload: null as unknown }))

vi.mock('@tanstack/react-router', () => ({
  useLoaderData: () => header.payload,
}))

afterEach(cleanup)

function payload(
  patch: Partial<TripHeaderPayload['trip']> = {},
): TripHeaderPayload {
  const person = { email: '', image: null, role: 'owner' }
  return {
    today: '2026-03-01',
    dayCount: 3,
    people: [
      { ...person, userId: 'u1', name: 'Ada Lovelace' },
      { ...person, userId: 'u2', name: 'Grace Hopper' },
    ],
    trip: {
      id: 'trip-1',
      title: 'Lisbon',
      slug: 'lisbon',
      summary: null,
      description: null,
      destination: null,
      status: 'booked',
      visibility: 'private',
      startDate: '2026-04-01',
      endDate: '2026-04-05',
      timezone: null,
      currency: 'EUR',
      countryCodes: [],
      coverImageUrl: null,
      accentColour: null,
      budgetTargetMinor: null,
      isArchived: false,
      ...patch,
    },
  }
}

function mount(data: TripHeaderPayload): HTMLElement {
  header.payload = data
  const { container } = render(
    <I18nProvider locale="pl" messages={PL}>
      <TripModuleHeader title="Koszty" />
    </I18nProvider>,
  )
  return container
}

describe('the trip header band in Polish', () => {
  it('renders the status, the length, the planned days and the travellers from the catalogue', () => {
    const band = mount(payload()).textContent

    expect(band).toContain(t('shell.tripStatus.booked'))
    expect(band).toContain(t('trips.header.length', { count: 5, days: '5' }))
    expect(band).toContain(t('trips.header.planned', { count: 3, days: '3' }))
    expect(band).toContain(
      t('costs.balances.count', { count: 2, travellers: '2' }),
    )
    expect(band).not.toMatch(/Booked|planned|traveller|\bdays?\b/)
  })

  it('says the dates are not set in Polish when the trip has none', () => {
    mount(payload({ startDate: null, endDate: null }))

    expect(screen.getByText(t('shell.trips.card.noDates'))).toBeTruthy()
    expect(screen.queryByText(/Dates not set/)).toBeNull()
  })
})

describe('nameFor', () => {
  const people = [{ userId: 'u1', name: 'Ada Lovelace' }]

  it('names a traveller on the trip', () => {
    expect(nameFor(people, 'u1', t)).toBe('Ada Lovelace')
  })

  it('translates the two fallbacks', () => {
    expect(nameFor(people, null, t)).toBe(t('modules.lists.unassigned'))
    expect(nameFor(people, 'gone', t)).toBe(t('costs.person.removed'))
  })
})
