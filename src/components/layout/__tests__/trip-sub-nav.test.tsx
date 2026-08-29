// @vitest-environment jsdom
import '#/components/ui/__tests__/test-env'

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TRIP_TAB_PREFERENCE, readRememberedTripTab } from '#/lib/trip-tab'
import { TripSubNav } from '../trip-sub-nav'

/**
 * The router, the catalogue and the animation, stood in for.
 *
 * `useRouterState` needs a router above it, `useTranslate` a provider, and the
 * active pill is a layout animation that says nothing about this strip's
 * contract. What is left is the subject of this file: which tab the strip lights
 * for a path, and which tab it therefore asks the browser to remember.
 */
const location = vi.hoisted(() => ({ pathname: '/trips/trip-1/plan' }))

vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string } }) => unknown
  }) => select({ location }),
  Link: ({
    to,
    params,
    children,
    ...rest
  }: {
    to: string
    params?: { tripId: string }
    children: React.ReactNode
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={to.replace('$tripId', params?.tripId ?? '')} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('motion/react', () => ({
  useReducedMotion: () => true,
  motion: {
    span: ({
      layoutId: _layoutId,
      transition: _transition,
      ...rest
    }: {
      layoutId?: string
      transition?: unknown
    } & React.HTMLAttributes<HTMLSpanElement>) => <span {...rest} />,
  },
}))

vi.mock('#/lib/i18n', () => ({
  useTranslate: () => (key: string) => key,
}))

function renderAt(pathname: string, tripId = 'trip-1') {
  location.pathname = pathname
  return render(<TripSubNav tripId={tripId} tripName="Lisbon in spring" />)
}

/** The one link the strip publishes as current, by its `aria-current` state. */
function currentTabHref(): string | null {
  return (
    screen
      .getByRole('navigation', { name: 'shell.trip.nav.label' })
      .querySelector('a[aria-current="page"]')
      ?.getAttribute('href') ?? null
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('TripSubNav', () => {
  it('lights the tab the reader is on and remembers it', () => {
    renderAt('/trips/trip-1/costs')

    expect(currentTabHref()).toBe('/trips/trip-1/costs')
    expect(readRememberedTripTab('trip-1')).toBe('costs')
  })

  it('lights and remembers the owning tab from a page deeper inside it', () => {
    renderAt('/trips/trip-1/lists/checklist-4')

    expect(currentTabHref()).toBe('/trips/trip-1/lists')
    expect(readRememberedTripTab('trip-1')).toBe('lists')
  })

  it('lights exactly one tab', () => {
    renderAt('/trips/trip-1/plan')

    expect(
      screen
        .getByRole('navigation', { name: 'shell.trip.nav.label' })
        .querySelectorAll('a[aria-current="page"]'),
    ).toHaveLength(1)
  })

  /**
   * A path the strip does not own — a future sub-route, or one withdrawn — is
   * not a tab, and writing the reader's memory from it would strand them on a
   * redirect to nowhere.
   */
  it('remembers nothing from a path that is not one of its tabs', () => {
    renderAt('/trips/trip-1/somewhere-else')

    expect(currentTabHref()).toBeNull()
    expect(window.localStorage.getItem(TRIP_TAB_PREFERENCE.key)).toBeNull()
  })

  it('remembers per trip rather than one tab for all of them', () => {
    renderAt('/trips/trip-1/files').unmount()
    renderAt('/trips/trip-2/book', 'trip-2')

    expect(readRememberedTripTab('trip-1')).toBe('files')
    expect(readRememberedTripTab('trip-2')).toBe('book')
  })
})
