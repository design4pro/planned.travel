// @vitest-environment jsdom
/**
 * The connection search once the journey it would replace was deleted elsewhere (#973).
 *
 * The dialog owns the state, so these cases cover what this tab does with it: the alert is shown in
 * the reader's language and no result row can be saved over a journey that is not there.
 */
import '#/components/ui/__tests__/test-env'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render as mount,
  screen,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { encodePublicFailure } from '#/lib/errors'
import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import { ConnectionSearch, SearchOutcome } from '../connection-search'

import type * as React from 'react'
import type { TransitConnection } from '#/server/fns/transports'

const stubs = vi.hoisted(() => ({
  save: vi.fn(),
  search: vi.fn(),
  stations: vi.fn(),
  invalidate: vi.fn(),
}))

// The real module reaches `cloudflare:workers`, which has no meaning in jsdom.
vi.mock('#/server/fns/transports', () => ({
  searchStationsFn: stubs.stations,
  searchConnectionsFn: stubs.search,
  saveSearchedConnectionFn: stubs.save,
}))
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: stubs.invalidate }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  stubs.save.mockResolvedValue({ transportId: 'saved' })
  stubs.search.mockResolvedValue({
    ok: true,
    connections: [CONNECTION],
    attributions: [],
    cached: false,
    remaining: 10,
    ceiling: 20,
  })
  stubs.stations.mockResolvedValue([
    {
      code: 'LIS',
      name: 'Lisboa',
      city: 'Lisboa',
      countryCode: 'PT',
      timezone: 'Europe/Lisbon',
      lat: 38.7,
      lng: -9.1,
    },
    {
      code: 'OPO',
      name: 'Porto',
      city: 'Porto',
      countryCode: 'PT',
      timezone: 'Europe/Lisbon',
      lat: 41.2,
      lng: -8.6,
    },
  ])
})
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
      tripCurrency="EUR"
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

it('keeps search choices and results after a stale save, then retries with the refreshed trip currency', async () => {
  stubs.save.mockRejectedValueOnce(
    new Error(
      encodePublicFailure({
        kind: 'refusal',
        message: 'costs.refusal.tripCurrencyChanged',
      }),
    ),
  )
  const saved = vi.fn()
  const onWriteError = vi.fn()
  const search = (tripCurrency: string) => (
    <I18nProvider locale="en" messages={MESSAGES}>
      <ConnectionSearch
        tripId="trip-1"
        tripCurrency={tripCurrency}
        days={[{ id: 'day-1', dayNumber: 1, date: '2026-10-09', title: null }]}
        onSaved={saved}
        onWriteError={onWriteError}
      />
    </I18nProvider>
  )
  const view = mount(search('EUR'))
  const user = userEvent.setup()
  for (const [label, name] of [
    ['From', 'LIS · Lisboa'],
    ['To', 'OPO · Porto'],
  ]) {
    await user.click(screen.getByRole('button', { name: label }))
    await user.type(screen.getByRole('combobox'), name.slice(0, 3))
    const option = await screen.findByRole('option', { name: new RegExp(name) })
    await user.click(option)
  }
  fireEvent.click(screen.getByRole('button', { name: 'Search connections' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Use this one' }))
  await vi.waitFor(() => expect(stubs.invalidate).toHaveBeenCalled())
  expect(stubs.save.mock.calls[0]?.[0].data).toMatchObject({
    expectedTripCurrency: 'EUR',
    currency: '',
    priceMinor: 0,
  })
  expect(saved).not.toHaveBeenCalled()
  expect(onWriteError).not.toHaveBeenCalled()
  view.rerender(search('GBP'))
  await vi.waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('GBP'),
  )
  expect(document.activeElement).toBe(screen.getByRole('alert'))
  expect(screen.getByRole('button', { name: 'From' }).textContent).toContain(
    'Lisboa',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Use this one' }))
  await vi.waitFor(() => expect(stubs.save).toHaveBeenCalledTimes(2))
  expect(stubs.save.mock.calls[1]?.[0].data).toMatchObject({
    expectedTripCurrency: 'GBP',
    currency: '',
    priceMinor: 0,
  })
})
