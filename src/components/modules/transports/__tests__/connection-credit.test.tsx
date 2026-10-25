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
import type {
  TransitAttribution,
  TransitConnection,
} from '#/server/fns/transports'

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

const ANSWER = {
  ok: true,
  attributions: [],
  cached: false,
  remaining: 10,
  ceiling: 20,
} as const

/** What HERE says must be shown with the route (#808): vendor words, shown as they came. */
const NOTICE: TransitAttribution = {
  id: 'R1-S1-link-0',
  text: 'Timetable data provided by CP - Comboios de Portugal',
  href: 'https://www.cp.pt/disclaimer',
  hrefText: 'CP - Comboios de Portugal',
}
const PLAIN_NOTICE: TransitAttribution = {
  id: 'R1-S1-link-1',
  text: 'Fares are set by the operator',
  href: null,
  hrefText: null,
}

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

describe('the source attributions HERE sends with a route', () => {
  it('stand beside the HERE credit, with the clickable part as the link', () => {
    outcome({
      outcome: { ...ANSWER, connections: [CONNECTION], attributions: [NOTICE] },
      results: [CONNECTION],
    })

    const credit = screen.getByRole('link', { name: 'HERE' }).closest('p')
    // The whole text is shown, as HERE wrote it, in the same caption as the credit.
    expect(credit?.textContent).toContain(NOTICE.text)

    const link = screen.getByRole('link', { name: 'CP - Comboios de Portugal' })
    expect(link.getAttribute('href')).toBe(NOTICE.href)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noreferrer')
    expect(link.closest('p')).toBe(credit)
  })

  it('link the whole text when HERE names no clickable part', () => {
    outcome({
      outcome: {
        ...ANSWER,
        connections: [CONNECTION],
        attributions: [{ ...NOTICE, hrefText: null }],
      },
      results: [CONNECTION],
    })

    const link = screen.getByRole('link', { name: NOTICE.text })
    expect(link.getAttribute('href')).toBe(NOTICE.href)
  })

  it('are plain words when HERE sends no link, and every one of them is shown', () => {
    outcome({
      outcome: {
        ...ANSWER,
        connections: [CONNECTION],
        attributions: [NOTICE, PLAIN_NOTICE],
      },
      results: [CONNECTION],
    })

    const credit = screen.getByRole('link', { name: 'HERE' }).closest('p')
    expect(credit?.textContent).toContain(PLAIN_NOTICE.text)
    expect(screen.queryByRole('link', { name: PLAIN_NOTICE.text })).toBeNull()
  })

  it('leave the caption as it was when HERE sent none', () => {
    outcome({
      outcome: { ...ANSWER, connections: [CONNECTION] },
      results: [CONNECTION],
    })

    const credit = screen.getByRole('link', { name: 'HERE' }).closest('p')
    expect(credit?.textContent).toBe('Timetable data from HERE')
  })

  it('are absent while a new answer is pending, on an empty answer and on a refusal', () => {
    const { unmount } = outcome({
      pending: true,
      outcome: { ...ANSWER, connections: [CONNECTION], attributions: [NOTICE] },
      results: [CONNECTION],
    })
    expect(screen.queryByText(NOTICE.text, { exact: false })).toBeNull()
    unmount()

    const empty = outcome({
      outcome: { ...ANSWER, connections: [], attributions: [NOTICE] },
      results: [],
    })
    expect(screen.queryByText(NOTICE.text, { exact: false })).toBeNull()
    empty.unmount()

    outcome({ outcome: { ok: false, reason: 'unreachable', ceiling: 20 } })
    expect(screen.queryByText(NOTICE.text, { exact: false })).toBeNull()
  })
})

describe('the markup of the credit caption (#1038)', () => {
  function caption() {
    outcome({
      outcome: {
        ...ANSWER,
        connections: [CONNECTION],
        attributions: [NOTICE, PLAIN_NOTICE],
      },
      results: [CONNECTION],
    })
    const credit = document.querySelector('[data-part="connection-credit"]')
    if (!credit) throw new Error('the credit caption is not rendered')
    return credit
  }

  it('wraps an unbroken vendor string instead of overflowing', () => {
    expect(caption().classList.contains('wrap-anywhere')).toBe(true)
  })

  it('isolates the direction of every notice in its own bdi', () => {
    const bdis = Array.from(caption().querySelectorAll('bdi'))

    expect(bdis.map((bdi) => bdi.textContent)).toEqual([
      NOTICE.text,
      PLAIN_NOTICE.text,
    ])
  })

  it('keeps single real spaces around each aria-hidden separator', () => {
    const credit = caption()
    const separators = Array.from(credit.querySelectorAll('[aria-hidden]'))

    // The credit and the first notice, then the two notices: one separator each.
    expect(separators).toHaveLength(2)
    for (const separator of separators) {
      expect(separator.getAttribute('aria-hidden')).toBe('true')
      expect(separator.previousSibling?.textContent?.endsWith(' ')).toBe(true)
      expect(separator.nextSibling?.textContent?.startsWith(' ')).toBe(true)
    }
    expect(credit.textContent).toBe(
      `Timetable data from HERE · ${NOTICE.text} · ${PLAIN_NOTICE.text}`,
    )
  })
})
