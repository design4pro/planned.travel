// @vitest-environment jsdom
/**
 * The connection search once the journey it would replace was deleted elsewhere (#973).
 *
 * The dialog owns the state, so these cases cover what this tab does with it: the alert is shown in
 * the reader's language and no result row can be saved over a journey that is not there.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render as mount, screen } from '@testing-library/react'

import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import { ConnectionSearch, SearchOutcome } from '../connection-search'

import type * as React from 'react'
import type { TransitConnection } from '#/server/fns/transports'

// The real module reaches `cloudflare:workers`, which has no meaning in jsdom.
vi.mock('#/server/fns/transports', () => ({
  searchStationsFn: () => Promise.resolve([]),
  searchConnectionsFn: () => Promise.resolve(null),
  saveSearchedConnectionFn: () => Promise.resolve(null),
}))
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
}))

afterEach(cleanup)

const MESSAGES = await loadCatalogue('en')

function render(ui: React.ReactElement) {
  return mount(
    <I18nProvider locale="en" messages={MESSAGES}>
      {ui}
    </I18nProvider>,
  )
}

const CONNECTION: TransitConnection = {
  id: 'R1',
  departureAt: '2026-10-09T08:12:00',
  arrivalAt: '2026-10-09T11:03:00',
  durationMinutes: 171,
  changes: 0,
  modes: ['train'],
  fare: null,
  legs: [
    {
      mode: 'train',
      name: 'IC 728',
      headsign: null,
      origin: {
        name: 'Lisboa',
        lat: null,
        lng: null,
        at: '2026-10-09T08:12:00',
      },
      destination: {
        name: 'Porto',
        lat: null,
        lng: null,
        at: '2026-10-09T11:03:00',
      },
      intermediateStops: [],
    },
  ],
}

function rows(saveBlocked: boolean) {
  return render(
    <SearchOutcome
      pending={false}
      outcome={{
        ok: true,
        attributions: [],
        cached: false,
        remaining: 10,
        ceiling: 20,
        connections: [CONNECTION],
      }}
      results={[CONNECTION]}
      expanded={null}
      saving={false}
      saveBlocked={saveBlocked}
      onToggle={() => {}}
      onSave={() => {}}
    />,
  )
}

function useButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Use this one' })
}

describe('a result row over a journey that is gone', () => {
  it('cannot be saved', () => {
    rows(true)

    expect(useButton().getAttribute('disabled')).not.toBeNull()
  })

  it('can be saved while the journey is there', () => {
    rows(false)

    expect(useButton().getAttribute('disabled')).toBeNull()
  })
})

describe('the connection search tab', () => {
  const search = (transportGone: boolean) => (
    <ConnectionSearch
      tripId="trip-1"
      transportId="transport-1"
      days={[]}
      onSaved={() => {}}
      transportGone={transportGone}
    />
  )

  it('shows the gone state as an alert in words, not as a key', () => {
    render(search(true))

    const alert = document.querySelector('[data-part="transport-gone"]')
    expect(alert?.getAttribute('role')).toBe('alert')
    expect(alert?.textContent).toContain('This transport no longer exists')
    expect(document.body.textContent).not.toContain(
      'modules.transports.refusal.gone',
    )
  })

  it('shows nothing of it while the journey is there', () => {
    render(search(false))

    expect(document.querySelector('[data-part="transport-gone"]')).toBeNull()
  })
})
