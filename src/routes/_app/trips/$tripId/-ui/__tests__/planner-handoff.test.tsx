// @vitest-environment jsdom
import '#/components/ui/__tests__/test-env'

import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render as mount, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { GOOGLE_DIRECTIONS_MAX_STOPS } from '#/lib/geo/handoff'
import { I18nProvider, LOCALE_TAGS, loadCatalogue } from '#/lib/i18n'
import { StopMenu } from '../plan-actions'
import { PlannerDayHandoff, PlannerDayTools } from '../planner-day-tools'

import type { PlannerDay, PlannerRow } from '#/components/planner'
import type { Locale } from '#/lib/i18n'

/**
 * The map hand-off controls: one pair of links in a stop's menu and one in the day's
 * footer. Presence and absence follow the coordinates; the accessible names say a new
 * tab opens and, for a day over the waypoint limit, how much of it the link carries.
 */

const MESSAGES = await loadCatalogue('en')

function render(
  ui: React.ReactElement,
  locale: Locale = 'en',
  messages = MESSAGES,
) {
  return mount(
    <I18nProvider locale={locale} messages={messages}>
      {ui}
    </I18nProvider>,
  )
}

function row(
  id: string,
  position: { lat: number | null; lng: number | null },
): PlannerRow {
  return {
    itemId: id,
    placeId: `place-${id}`,
    assignmentId: id,
    name: `Place ${id}`,
    location: null,
    time: null,
    duration: null,
    categoryId: null,
    imageUrl: null,
    rating: null,
    note: null,
    reservationStatus: 'none',
    visited: false,
    dayNumber: 3,
    ...position,
  }
}

const UNPLACED = { lat: null, lng: null }

function dayOf(rows: ReadonlyArray<PlannerRow>): PlannerDay {
  return {
    dayId: 'd3',
    dayNumber: 3,
    title: 'Day 3',
    dateLabel: null,
    stays: [],
    rows,
    items: rows.map((entry) => ({ kind: 'stop', row: entry })),
  }
}

function placedRows(count: number): ReadonlyArray<PlannerRow> {
  return Array.from({ length: count }, (_, index) =>
    row(String(index + 1), { lat: index + 1, lng: 10 }),
  )
}

function tools(day: PlannerDay) {
  return <PlannerDayTools day={day} onAddPlace={vi.fn()} onAddStay={vi.fn()} />
}

describe('PlannerDayTools — the day hand-off', () => {
  it('offers nothing for a day with no placed stop', () => {
    render(tools(dayOf([row('1', UNPLACED), row('2', UNPLACED)])))

    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('offers a point link, not directions, for exactly one placed stop', () => {
    render(tools(dayOf([row('1', UNPLACED), row('2', { lat: 35, lng: 135 })])))

    const link = screen.getByRole('link', {
      name: 'Show on Google Maps: the one mapped stop of Day 3 (opens in a new tab)',
    })
    expect(link.textContent).toBe('Show on Google Maps')
    expect(link.getAttribute('href')).toBe(
      'https://www.google.com/maps/search/?api=1&query=35%2C135',
    )
    expect(screen.queryByText(/Directions/)).toBeNull()
  })

  it('offers directions through the placed stops, in order, as a real new-tab anchor', () => {
    render(
      tools(
        dayOf([
          row('1', { lat: 1, lng: 10 }),
          row('2', UNPLACED),
          row('3', { lat: 3, lng: 10 }),
        ]),
      ),
    )

    const link = screen.getByRole('link', {
      name: 'Directions in Google Maps for Day 3 (opens in a new tab)',
    })
    // Label in Name (WCAG 2.5.3): the name opens with what is drawn.
    expect(link.textContent).toBe('Directions in Google Maps')
    expect(link.getAttribute('href')).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=1%2C10&destination=3%2C10',
    )
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('carries exactly the maximum without a note', () => {
    render(tools(dayOf(placedRows(GOOGLE_DIRECTIONS_MAX_STOPS))))

    const link = screen.getByRole('link', {
      name: /^Directions in Google Maps/,
    })
    expect(link.textContent).toBe('Directions in Google Maps')
    expect(link.getAttribute('aria-label')).not.toContain('first')
  })

  it('says in text and in the name how much of a long day the link carries', () => {
    const total = GOOGLE_DIRECTIONS_MAX_STOPS + 2
    render(tools(dayOf(placedRows(total))))

    const note = `Stops: first ${GOOGLE_DIRECTIONS_MAX_STOPS} of ${total}`
    const link = screen.getByRole('link', {
      name: `Directions in Google Maps for Day 3, ${note.toLowerCase()} (opens in a new tab)`,
    })
    expect(link.textContent).toBe(`Directions in Google Maps${note}`)
  })

  it.each(LOCALE_TAGS)(
    'opens each control’s name with its visible label in %s',
    async (locale) => {
      render(
        tools(dayOf(placedRows(GOOGLE_DIRECTIONS_MAX_STOPS + 1))),
        locale,
        await loadCatalogue(locale),
      )

      const link = screen.getByRole('link')
      const label = link.querySelector('span')?.textContent ?? ''
      expect(label).not.toBe('')
      expect(link.getAttribute('aria-label')?.startsWith(label)).toBe(true)
    },
  )
})

describe('StopMenu — the stop hand-off', () => {
  function menu(entry: PlannerRow) {
    return (
      <StopMenu
        row={entry}
        days={[]}
        onEditPlace={vi.fn()}
        onEditTiming={vi.fn()}
        onPickPosition={vi.fn()}
        onMoveToDay={vi.fn()}
        onUnschedule={vi.fn()}
        onDelete={vi.fn()}
      />
    )
  }

  async function open(entry: PlannerRow): Promise<void> {
    render(menu(entry))
    await userEvent.click(
      screen.getByRole('button', { name: 'Actions for Place 1' }),
    )
  }

  it('offers both services for a stop with coordinates, as new-tab links', async () => {
    await open(row('1', { lat: 34.9671, lng: 135.7727 }))

    const google = screen.getByRole('menuitem', {
      name: 'Open Place 1 in Google Maps (opens in a new tab)',
    })
    expect(google.textContent).toBe('Google Maps')
    expect(google.getAttribute('href')).toBe(
      'https://www.google.com/maps/search/?api=1&query=34.9671%2C135.7727',
    )

    const osm = screen.getByRole('menuitem', {
      name: 'Open Place 1 in OpenStreetMap (opens in a new tab)',
    })
    expect(osm.getAttribute('href')).toBe(
      'https://www.openstreetmap.org/?mlat=34.9671&mlon=135.7727#map=17/34.9671/135.7727',
    )
    for (const link of [google, osm]) {
      expect(link.tagName).toBe('A')
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    }
  })

  it.each([
    ['no coordinates', UNPLACED],
    ['a latitude only', { lat: 35, lng: null }],
    ['a longitude only', { lat: null, lng: 135 }],
  ])('offers no hand-off for a stop with %s', async (_name, position) => {
    await open(row('1', position))

    expect(screen.getByRole('menuitem', { name: 'Edit place' })).toBeDefined()
    expect(screen.queryByRole('menuitem', { name: /Google Maps/ })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: /OpenStreetMap/ })).toBeNull()
  })
})

describe('PlannerDayHandoff — read-only day footer', () => {
  it('keeps the partial-day note and offers no write controls', () => {
    const total = GOOGLE_DIRECTIONS_MAX_STOPS + 2
    render(<PlannerDayHandoff day={dayOf(placedRows(total))} />)
    expect(
      screen.getByRole('link', {
        name: `Directions in Google Maps for Day 3, stops: first ${GOOGLE_DIRECTIONS_MAX_STOPS} of ${total} (opens in a new tab)`,
      }).textContent,
    ).toContain(`Stops: first ${GOOGLE_DIRECTIONS_MAX_STOPS} of ${total}`)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('renders no footer when the day has no placed stop', () => {
    const { container } = render(
      <PlannerDayHandoff day={dayOf([row('1', UNPLACED)])} />,
    )
    expect(container.childElementCount).toBe(0)
  })
})
