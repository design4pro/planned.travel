import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import { TripHeroStrip } from '../trip-hero-strip'
import { tripCard } from './fixtures'

import type { Catalogue } from '#/lib/i18n'
import type { TripCard } from '../../-server/overview'

const EN: Catalogue = {
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('ui', Ui),
}

afterEach(cleanup)

/** The fixture trip runs 1 to 10 April: ten days, nine nights. */
function mount(today: string, elapsed: number | null, trip?: TripCard): void {
  render(
    <I18nProvider locale="en" messages={EN}>
      <TripHeroStrip
        trip={trip ?? tripCard()}
        today={today}
        elapsed={elapsed}
      />
    </I18nProvider>,
  )
}

/** The figure under a strip label, read through the `dt`/`dd` pairing a reader hears. */
function figure(label: string): string {
  const term = screen.getByText(label, { selector: 'dt' })
  return term.nextElementSibling?.textContent ?? ''
}

describe('the prominent card’s progress bar', () => {
  it('is absent before the trip starts', () => {
    mount('2026-03-20', 0)
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('is named and reads day one of ten on the first day', () => {
    mount('2026-04-01', 0.1)
    const bar = screen.getByRole('progressbar', { name: 'Under way' })
    expect(bar.getAttribute('aria-valuenow')).toBe('10')
  })

  it('reads full on the last day, which is still under way', () => {
    mount('2026-04-10', 1)
    const bar = screen.getByRole('progressbar', { name: 'Under way' })
    expect(bar.getAttribute('aria-valuenow')).toBe('100')
  })

  it('is gone once the trip has ended', () => {
    mount('2026-04-11', 1)
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('is absent without dates', () => {
    mount('2026-04-05', null, tripCard({ startDate: null, endDate: null }))
    expect(screen.queryByRole('progressbar')).toBeNull()
  })
})

describe('the prominent card’s strip', () => {
  /**
   * The trip's own people, not the workspace's: the figure has only the trip to come from, and a
   * count the fixture does not share with any other field proves which one it is.
   */
  it('shows the trip’s nights, places and people', () => {
    mount('2026-03-20', 0, tripCard({ placeCount: 12, peopleCount: 7 }))
    expect(figure('Nights')).toBe('9')
    expect(figure('Places')).toBe('12')
    expect(figure('Travellers')).toBe('7')
  })

  it('shows no nights, and asks for dates, when the trip has none', () => {
    mount('2026-03-20', null, tripCard({ startDate: null, endDate: null }))
    expect(figure('Nights')).toBe('—')
    expect(screen.queryByText('Add dates to build days')).not.toBeNull()
  })
})
