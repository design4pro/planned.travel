// The menu mounts Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import { TripActionsMenu, useTripFavourite } from '../trip-actions'
import { tripCard } from './fixtures'

import type { Catalogue } from '#/lib/i18n'
import type { TripCard } from '../../-server/overview'

const EN: Catalogue = {
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('ui', Ui),
}

/** Every write the menu can start reaches `cloudflare:workers`, which jsdom has no answer for. */
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
vi.mock('@tanstack/react-router', () => ({ useRouter: () => router }))

afterEach(cleanup)

/**
 * The star now belongs to whoever renders the menu — `TripTile` in the product, this harness here —
 * so the suite mounts the menu the way the tile does rather than with a hand-built stand-in that
 * could disagree with the real hook.
 */
function Menu({ trip }: { trip: TripCard }) {
  return <TripActionsMenu trip={trip} favourite={useTripFavourite(trip)} />
}

async function openMenu(trip: TripCard): Promise<Array<string>> {
  const user = userEvent.setup()
  render(
    <I18nProvider locale="en" messages={EN}>
      <Menu trip={trip} />
    </I18nProvider>,
  )
  await user.click(
    screen.getByRole('button', { name: `Actions for ${trip.title}` }),
  )
  return screen.getAllByRole('menuitem').map((item) => item.textContent.trim())
}

function enabled(name: string): boolean {
  const item = screen.getByRole('menuitem', { name })
  return item.getAttribute('aria-disabled') !== 'true'
}

describe('the trip action menu', () => {
  /**
   * Every reader may copy a trip they can see (PRD #104 decision 6), so Copy is not an owner's
   * privilege — it is the first of the two items a viewer has, above the star.
   */
  it('offers a viewer exactly Copy and Favourite, in that order', async () => {
    expect(await openMenu(tripCard({ role: null }))).toEqual([
      'Copy',
      'Favourite',
    ])
  })

  it('keeps Copy at the top of an owner’s longer menu', async () => {
    expect(await openMenu(tripCard({ role: 'owner' }))).toEqual([
      'Copy',
      'Favourite',
      'Edit',
      'Archive',
      'Delete',
    ])
  })

  it('opens the copy dialog rather than writing anything itself', async () => {
    const user = userEvent.setup()
    await openMenu(tripCard())
    await user.click(screen.getByRole('menuitem', { name: 'Copy' }))

    expect(
      screen.queryByRole('dialog', { name: 'Copy “Lisbon in April”' }),
    ).not.toBeNull()
    expect(server.copy).not.toHaveBeenCalled()
  })

  /**
   * A trip the `trip-copy` handler is still filling in is not yet the thing the other items claim
   * to act on. Delete stays, because abandoning a copy that is taking too long is the one thing a
   * reader may legitimately want from this menu.
   */
  it('leaves a copying trip nothing but Delete, and says why', async () => {
    const items = await openMenu(tripCard({ copyPending: true }))

    expect(items).toEqual(['Copy', 'Favourite', 'Edit', 'Archive', 'Delete'])
    expect(screen.queryByText('Wait for the copy to finish.')).not.toBeNull()
    expect(enabled('Copy')).toBe(false)
    expect(enabled('Favourite')).toBe(false)
    expect(enabled('Edit')).toBe(false)
    expect(enabled('Archive')).toBe(false)
    expect(enabled('Delete')).toBe(true)
  })
})
