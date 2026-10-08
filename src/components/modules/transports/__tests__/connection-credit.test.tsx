// @vitest-environment jsdom
/**
 * The HERE credit on the connection search's outcome region (#802).
 *
 * HERE's terms owe a credit wherever a routed answer appears (ADR 0019), so the credit follows the
 * answer: it is under the ranked list and in none of the four states that stand in for one. The
 * outcome region is the seam because it is the one place all five states are decided.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render as mount, screen } from '@testing-library/react'

import { HERE_CREDITS } from '#/lib/geo/credits'
import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import { SearchOutcome } from '../connection-search'

import type * as React from 'react'
import type { ComponentProps } from 'react'
import type { TransitConnection } from '#/server/fns/transports'

// The real module reaches `cloudflare:workers`, which has no meaning in jsdom; no state under test
// calls a server function.
vi.mock('#/server/fns/transports', () => ({
  searchStationsFn: () => Promise.resolve([]),
  searchConnectionsFn: () => Promise.resolve(null),
  saveSearchedConnectionFn: () => Promise.resolve(null),
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

const ANSWER = { ok: true, cached: false, remaining: 10, ceiling: 20 } as const

type Props = ComponentProps<typeof SearchOutcome>

function outcome(overrides: Partial<Props>) {
  return render(
    <SearchOutcome
      pending={false}
      outcome={null}
      results={[]}
      expanded={null}
      saving={false}
      onToggle={() => {}}
      onSave={() => {}}
      {...overrides}
    />,
  )
}

describe('the HERE credit on the connection search', () => {
  it('follows the ranked list, as a link to HERE', () => {
    const { container } = outcome({
      outcome: { ...ANSWER, connections: [CONNECTION] },
      results: [CONNECTION],
    })

    const link = screen.getByRole('link', { name: 'HERE' })
    expect(link.getAttribute('href')).toBe(HERE_CREDITS[0].url)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noreferrer')

    const caption = link.closest('p')
    expect(caption?.textContent).toBe('Timetable data from HERE')
    // After the last row, in the same scrolling region, so nothing pinned below can cover it.
    const list = container.querySelector('ul')
    expect(list?.nextElementSibling).toBe(caption)
  })

  it('is absent while a new answer is pending, even over the previous list', () => {
    outcome({
      pending: true,
      outcome: { ...ANSWER, connections: [CONNECTION] },
      results: [CONNECTION],
    })
    expect(screen.queryByRole('link', { name: 'HERE' })).toBeNull()
  })

  it('is absent before anything was asked', () => {
    outcome({ outcome: null })
    expect(screen.queryByRole('link', { name: 'HERE' })).toBeNull()
  })

  it('is absent on an answer with nothing in it', () => {
    outcome({ outcome: { ...ANSWER, connections: [] }, results: [] })
    expect(screen.queryByRole('link', { name: 'HERE' })).toBeNull()
  })

  it('is absent on a refusal', () => {
    outcome({ outcome: { ok: false, reason: 'unreachable', ceiling: 20 } })
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'HERE' })).toBeNull()
  })
})
