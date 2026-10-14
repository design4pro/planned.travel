// The tile carries the action menu, whose Radix primitives need the
// pointer-capture and scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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
vi.mock('#/components/modules/files/upload', () => ({ uploadFile: vi.fn() }))

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

/**
 * The corner star, which the menu item and the badge have to answer alike (#207).
 *
 * The two used to be two answers: the menu kept an optimistic overlay to itself and the badge read
 * the loader payload, so a press lit the label at once and left the mark beside it unchanged until
 * the write and `router.invalidate()` had both come back. Both cases below measure precisely that
 * window — the server function is held open, so nothing has landed and no loader has re-run when
 * the badge is read.
 */
describe('the tile’s favourite mark', () => {
  /**
   * Holds `setTripFavouriteFn` open so the assertions land mid-write rather than after it, and
   * hands back the key that lets it land.
   *
   * The returned closure calls `land` rather than *being* it: the factory below does not run until
   * the mock is first called, which is long after this function has returned, so handing `land`
   * back directly would hand back the placeholder it was bound to here.
   */
  function holdTheWrite(): () => void {
    let land: () => void = () => undefined
    server.favourite.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          land = resolve
        }),
    )
    return () => land()
  }

  async function press(item: 'Favourite' | 'Unfavourite'): Promise<void> {
    const user = userEvent.setup()
    await user.click(
      screen.getByRole('button', { name: 'Actions for Lisbon in April' }),
    )
    await user.click(screen.getByRole('menuitem', { name: item }))
  }

  /**
   * Not redundant with the `ui` project's `restoreMocks`: these are `vi.hoisted` `vi.fn()`s handed
   * to a module factory rather than spies, and their call counts demonstrably survive into the next
   * case — without this, a `router.invalidate` from the case above fails the one below.
   */
  afterEach(() => {
    server.favourite.mockReset()
    router.invalidate.mockReset()
  })

  it('lights the moment the reader presses Favourite, not when the write lands', async () => {
    const land = holdTheWrite()
    mount(tripCard({ isFavourite: false }))
    expect(screen.queryByLabelText('Favourite')).toBeNull()

    await press('Favourite')

    expect(router.invalidate).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Favourite')).not.toBeNull()

    await act(async () => {
      land()
    })
  })

  it('goes dark the moment the reader presses Unfavourite', async () => {
    const land = holdTheWrite()
    mount(tripCard({ isFavourite: true }))
    expect(screen.queryByLabelText('Favourite')).not.toBeNull()

    await press('Unfavourite')

    expect(router.invalidate).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Favourite')).toBeNull()

    await act(async () => {
      land()
    })
  })

  /**
   * The other half of the overlay's promise: the claim is withdrawn only once `useAction` has
   * awaited the invalidation, so the star goes empty → lit once rather than empty → lit → empty →
   * lit on its way to the loader's answer.
   */
  it('holds the star until the invalidation lands, so it never flickers back', async () => {
    server.favourite.mockResolvedValue({ tripId: 'trip-1', isFavourite: true })
    let landInvalidation: () => void = () => undefined
    router.invalidate.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          landInvalidation = resolve
        }),
    )
    mount(tripCard({ isFavourite: false }))

    await press('Favourite')

    // The write has answered and the loader has not: the claim has to stand, because the payload
    // this tile still holds says the trip is not starred.
    await waitFor(() => expect(router.invalidate).toHaveBeenCalled())
    expect(screen.queryByLabelText('Favourite')).not.toBeNull()

    await act(async () => {
      landInvalidation()
    })
  })

  /**
   * The rollback. A refused write withdraws the claim like any other settlement, so the tile falls
   * back to what the loader says rather than keeping a star the server never accepted; the reason
   * reaches the reader through the toast `useAction` raises.
   */
  it('rolls the star back when the write is refused', async () => {
    server.favourite.mockRejectedValue(new Error('the server said no'))
    mount(tripCard({ isFavourite: false }))

    await press('Favourite')

    await waitFor(() => expect(screen.queryByLabelText('Favourite')).toBeNull())
    expect(router.invalidate).not.toHaveBeenCalled()
  })
})
