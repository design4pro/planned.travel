// The tile carries the action menu, whose Radix primitives need the
// pointer-capture and scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import { TripTile } from '../trip-card'
import { tripCard } from './fixtures'

import type * as React from 'react'
import type { Catalogue } from '#/lib/i18n'
import type { TripCard } from '../../-server/overview'

const EN: Catalogue = {
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('ui', Ui),
}

const server = vi.hoisted(() => ({
  archive: vi.fn(),
  copy: vi.fn(),
  remove: vi.fn(),
  restore: vi.fn(),
  favourite: vi.fn(),
  summary: vi.fn(),
  update: vi.fn(),
}))
const router = vi.hoisted(() => ({ invalidate: vi.fn() }))

vi.mock('../../-server/trip-lifecycle', () => ({
  archiveTripFn: server.archive,
  copyTripFn: server.copy,
  deleteTripFn: server.remove,
  restoreTripFn: server.restore,
  setTripFavouriteFn: server.favourite,
  tripDeleteSummaryFn: server.summary,
  updateTripFn: server.update,
}))

/**
 * `Link` stands in as a plain anchor, so "is this tile a link?" is answered by the accessibility
 * tree rather than by a router this suite does not have. A tile that stopped being a link would
 * otherwise still look like one to `getByRole`.
 */
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => router,
  Link: ({
    children,
    className,
  }: {
    children?: React.ReactNode
    className?: string
  }) => (
    <a href="/trips/trip-1/plan" className={className}>
      {children}
    </a>
  ),
}))

afterEach(cleanup)

function mount(trip: TripCard): void {
  render(
    <I18nProvider locale="en" messages={EN}>
      <TripTile trip={trip} today="2026-03-01" />
    </I18nProvider>,
  )
}

function tile(): HTMLElement {
  const found = document.querySelector('[data-part="trip-tile"]')
  if (!(found instanceof HTMLElement)) {
    throw new Error('the grid rendered no tile')
  }
  return found
}

describe('a trip tile whose copy is still running', () => {
  /**
   * A trip whose places have not landed is a planner with an empty day list, and handing that to a
   * reader is worse than making them wait for the list to revalidate.
   */
  it('is not a link, and says so to assistive tech', () => {
    mount(tripCard({ copyPending: true }))

    expect(screen.queryByRole('link')).toBeNull()
    expect(tile().getAttribute('aria-busy')).toBe('true')
  })

  it('marks the cover with a named Copying chip', () => {
    mount(tripCard({ copyPending: true }))

    expect(
      screen.queryByLabelText('Lisbon in April is still being copied'),
    ).not.toBeNull()
    expect(screen.queryByText('Copying')).not.toBeNull()
  })

  /**
   * The counts are behind a skeleton rather than printed: a copy mid-flight shows `0 places` for as
   * long as the handler runs, and a zero is a claim rather than an absence.
   */
  it('holds the counts back rather than printing a figure that is not true yet', () => {
    mount(tripCard({ copyPending: true, placeCount: 0 }))

    expect(screen.queryByText('0')).toBeNull()
    expect(screen.queryByText('10d')).toBeNull()
  })

  it('is an ordinary link with its counts once the stamp clears', () => {
    mount(tripCard({ copyPending: false }))

    expect(screen.queryByRole('link')).not.toBeNull()
    expect(tile().hasAttribute('aria-busy')).toBe(false)
    expect(screen.queryByText('Copying')).toBeNull()
    expect(screen.queryByText('12')).not.toBeNull()
  })
})
