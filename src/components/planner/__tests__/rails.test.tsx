// @vitest-environment jsdom
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render as mount, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DndContext } from '@dnd-kit/core'

import { I18nProvider, loadCatalogue } from '#/lib/i18n'
import { DaySection } from '../day-section'
import { DragPreview } from '../drag-preview'
import { IdeasList } from '../ideas-list'
import { PlannerRail } from '../rail'
import { ideaItemId, legItemId } from '../ordering'

import { stopsOf } from '../types'

import type {
  PlannerCategory,
  PlannerDay,
  PlannerItem,
  PlannerNote,
  PlannerRow,
  PlannerStay,
  PlannerTransport,
} from '../types'

/**
 * The rails, mounted for real.
 *
 * `@dnd-kit` needs a `DndContext` above every sortable, so each case renders the same
 * shell the planner does. That makes this an integration test of the whole visible
 * left-and-right surface of the screen rather than a unit test of one row, which is
 * the level the interesting failures live at: a missing droppable, a row that cannot
 * be reached by keyboard, a count that disagrees with its list.
 */

/**
 * `DaySection` translates the day's note affordances, and `useTranslate` throws rather
 * than quietly rendering English, so every mount here sits under the real `en`
 * catalogue — which also means these cases assert on the shipped words.
 */
const MESSAGES = await loadCatalogue('en')

function render(ui: React.ReactElement) {
  const view = mount(
    <I18nProvider locale="en" messages={MESSAGES}>
      {ui}
    </I18nProvider>,
  )
  return {
    ...view,
    rerender: (next: React.ReactElement) =>
      view.rerender(
        <I18nProvider locale="en" messages={MESSAGES}>
          {next}
        </I18nProvider>,
      ),
  }
}

const CATEGORIES: ReadonlyArray<PlannerCategory> = [
  { id: 'c-shrine', name: 'Sights', colour: '#2f6f5e', icon: 'church' },
  { id: 'c-food', name: 'Food', colour: '#b26b08', icon: 'utensils' },
]

function categoryFor(categoryId: string | null): PlannerCategory | undefined {
  return CATEGORIES.find((category) => category.id === categoryId)
}

/**
 * Spread over the defaults rather than `??`-ing each field: half these cases are
 * about a field being explicitly `null`, and `null ?? default` would quietly
 * substitute the default and make the test pass for the wrong reason.
 */
function row(overrides: Partial<PlannerRow> & { placeId: string }): PlannerRow {
  return {
    itemId: `a-${overrides.placeId}`,
    assignmentId: `a-${overrides.placeId}`,
    name: 'Sensō-ji',
    location: '2-3-1 Asakusa, Taito City',
    time: null,
    duration: null,
    categoryId: 'c-shrine',
    imageUrl: null,
    rating: null,
    note: null,
    reservationStatus: 'none',
    lng: 139.7966,
    lat: 35.7148,
    visited: false,
    dayNumber: 1,
    ...overrides,
  }
}

/**
 * The day's two lists, as the one sequence the section now renders.
 *
 * `rows` is derived rather than declared so a fixture cannot describe a day whose
 * stop list and sequence disagree — the exact state `PlannerDay.items` exists to make
 * unrepresentable.
 */
function sequence(
  items: ReadonlyArray<PlannerItem>,
): Pick<PlannerDay, 'items' | 'rows'> {
  return { items, rows: stopsOf(items) }
}

const NOTE: PlannerNote = {
  id: 'n1',
  dayId: 'd1',
  body: 'Buy the metro pass at the airport',
  detail: null,
  time: '08:00',
  icon: 'sticky-note',
}

/** Three nights in Shinjuku: in on day 1, out on day 4. */
const STAY: PlannerStay = {
  id: 's1',
  name: 'Shinjuku Granbell Hotel',
  startDayId: 'd1',
  endDayId: 'd4',
  checkIn: '15:00 – 18:00',
  checkOut: '11:00',
  reservationId: 'r1',
}

const DAY: PlannerDay = {
  dayId: 'd1',
  dayNumber: 1,
  title: 'Asakusa and the river',
  dateLabel: 'Fri, 9 Oct',
  stays: [STAY],
  // An 08:00 note above a 09:00 stop: the merged order, which is what the day is
  // handed and what it must render.
  ...sequence([
    { kind: 'note', note: NOTE },
    {
      kind: 'stop',
      row: row({
        placeId: 'p-sensoji',
        name: 'Sensō-ji',
        time: '09:00 – 10:30',
        duration: '1h 30m',
        rating: 5,
        reservationStatus: 'confirmed',
      }),
    },
    {
      kind: 'stop',
      row: row({
        placeId: 'p-skytree',
        name: 'Tokyo Skytree',
        categoryId: 'c-food',
        time: '11:00',
        note: 'Book the fast track — the queue is an hour at noon.',
      }),
    },
    {
      kind: 'stop',
      row: row({
        placeId: 'p-unmapped',
        name: 'That bar Yuki mentioned',
        location: null,
        lng: null,
        lat: null,
        categoryId: null,
      }),
    },
  ]),
}

const EMPTY_DAY: PlannerDay = {
  dayId: 'd2',
  dayNumber: 2,
  title: 'Day 2',
  dateLabel: 'Sat, 10 Oct',
  stays: [],
  ...sequence([]),
}

/** A day holding notes and no stops — empty of places, but not an empty day. */
const NOTES_ONLY_DAY: PlannerDay = {
  dayId: 'd3',
  dayNumber: 3,
  title: 'Day 3',
  dateLabel: 'Sun, 11 Oct',
  stays: [],
  ...sequence([{ kind: 'note', note: { ...NOTE, id: 'n2', dayId: 'd3' } }]),
}

const IDEAS: ReadonlyArray<PlannerRow> = [
  row({
    placeId: 'p-ichiran',
    itemId: ideaItemId('p-ichiran'),
    assignmentId: null,
    name: 'Ichiran Shibuya',
    categoryId: 'c-food',
    location: 'Shibuya',
    dayNumber: null,
  }),
  row({
    placeId: 'p-kinkaku',
    itemId: ideaItemId('p-kinkaku'),
    assignmentId: null,
    name: 'Kinkaku-ji',
    location: 'Kita Ward, Kyoto',
    dayNumber: null,
  }),
]

function Harness({ children }: { children: React.ReactNode }) {
  return <DndContext>{children}</DndContext>
}

/* -------------------------------------------------------------------------------------------------
 * Itinerary
 * ---------------------------------------------------------------------------------------------- */

describe('DaySection', () => {
  it('renders the day, its date, its stay and its stop count', () => {
    render(
      <Harness>
        <DaySection day={DAY} categoryFor={categoryFor} />
      </Harness>,
    )

    const section = screen.getByRole('region', {
      name: 'Asakusa and the river, Fri, 9 Oct',
    })
    expect(within(section).getByText('Asakusa and the river')).toBeDefined()
    expect(within(section).getByText('Fri, 9 Oct')).toBeDefined()
    expect(within(section).getByText('3 stops')).toBeDefined()
    expect(within(section).getByText('Shinjuku Granbell Hotel')).toBeDefined()
  })

  /**
   * "Where am I sleeping tonight", answered without opening the day: the first night says
   * check in with its window, a night between names the property, the last says check out.
   */
  describe('its stay', () => {
    function badgeOn(dayId: string, stay: PlannerStay = STAY): HTMLElement {
      const { container } = render(
        <Harness>
          <DaySection
            day={{ ...EMPTY_DAY, dayId, stays: [stay] }}
            categoryFor={categoryFor}
          />
        </Harness>,
      )
      const badge = container.querySelector<HTMLElement>(
        '[data-part="day-stay"]',
      )
      if (badge === null) throw new Error('the day drew no stay badge')
      return badge
    }

    /** What assistive technology reads: the text without the parts drawn only for the eye. */
    function spoken(badge: HTMLElement): string {
      const copy = badge.cloneNode(true) as HTMLElement
      for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) {
        hidden.remove()
      }
      return copy.textContent ?? ''
    }

    it('reads check in with its window on the first day', () => {
      expect(spoken(badgeOn('d1'))).toBe(
        'Check in 15:00 – 18:00, Shinjuku Granbell Hotel',
      )
    })

    it('names only the property on a night between', () => {
      expect(spoken(badgeOn('d2'))).toBe('Shinjuku Granbell Hotel')
    })

    it('reads check out with its time on the last day', () => {
      expect(spoken(badgeOn('d4'))).toBe(
        'Check out 11:00, Shinjuku Granbell Hotel',
      )
    })

    it('reads both on a stay that begins and ends on the same day', () => {
      const badge = badgeOn('d1', { ...STAY, endDayId: 'd1' })
      expect(spoken(badge)).toBe(
        'Check in 15:00 – 18:00, Check out 11:00, Shinjuku Granbell Hotel',
      )
    })

    it('prints no time and no gap for a boundary without one', () => {
      const badge = badgeOn('d1', { ...STAY, checkIn: null })
      expect(spoken(badge)).toBe('Check in, Shinjuku Granbell Hotel')
    })

    it('is a fact of the header and never a row of the day', () => {
      render(
        <Harness>
          <DaySection day={DAY} categoryFor={categoryFor} />
        </Harness>,
      )
      const stop = screen.getByText('Sensō-ji').closest('ul')
      const stay = screen.getByText('Shinjuku Granbell Hotel').closest('ul')
      expect(stop).not.toBeNull()
      expect(stay).not.toBe(stop)
      expect(stop?.contains(stay ?? null)).toBe(false)
    })
  })

  it('numbers the stops in visiting order', () => {
    const { container } = render(
      <Harness>
        <DaySection day={DAY} categoryFor={categoryFor} />
      </Harness>,
    )

    const rows = [...container.querySelectorAll('[data-planner-item]')]
    expect(
      rows.map((entry) => entry.getAttribute('data-planner-place')),
    ).toEqual(['p-sensoji', 'p-skytree', 'p-unmapped'])
    // The numeral is decorative, so it is read off each row's own subtree.
    expect(
      rows.map((entry) => entry.textContent.trimStart().slice(0, 1)),
    ).toEqual(['1', '2', '3'])
  })

  it('gives every row a complete accessible name, not just a place name', () => {
    render(
      <Harness>
        <DaySection day={DAY} categoryFor={categoryFor} />
      </Harness>,
    )

    const name = screen
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? '')
      .find((label) => label.startsWith('Sensō-ji'))

    expect(name).toBeDefined()
    expect(name).toContain('Sights')
    expect(name).toContain('stop 1')
    expect(name).toContain('day 1')
    expect(name).toContain('09:00 – 10:30')
    expect(name).toContain('rated 5 out of 5')
    expect(name).toContain('Booked')
  })

  it('says so when a place has no map position', () => {
    render(
      <Harness>
        <DaySection day={DAY} categoryFor={categoryFor} />
      </Harness>,
    )
    expect(screen.getByText('No map position yet')).toBeDefined()
    const label = screen
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? '')
      .find((entry) => entry.startsWith('That bar'))
    expect(label).toContain('no map position')
  })

  it('shows the stop note and the day note', () => {
    render(
      <Harness>
        <DaySection day={DAY} categoryFor={categoryFor} />
      </Harness>,
    )
    expect(
      screen.getByText('Book the fast track — the queue is an hour at noon.'),
    ).toBeDefined()
    expect(screen.getByText('Buy the metro pass at the airport')).toBeDefined()
    expect(screen.getByText('08:00')).toBeDefined()
  })

  it('gives every row its own keyboard-reachable drag handle', () => {
    render(
      <Harness>
        <DaySection day={DAY} categoryFor={categoryFor} />
      </Harness>,
    )
    expect(
      screen.getByRole('button', { name: 'Reorder Sensō-ji' }),
    ).toBeDefined()
    expect(
      screen.getByRole('button', { name: 'Reorder Tokyo Skytree' }),
    ).toBeDefined()
  })

  it('drops the drag handles when the trip is read-only', () => {
    render(
      <Harness>
        <DaySection day={DAY} categoryFor={categoryFor} draggable={false} />
      </Harness>,
    )
    expect(
      screen.queryByRole('button', { name: 'Reorder Sensō-ji' }),
    ).toBeNull()
  })

  it('invites a drop on an empty day rather than showing nothing', () => {
    render(
      <Harness>
        <DaySection day={EMPTY_DAY} categoryFor={categoryFor} />
      </Harness>,
    )
    expect(
      screen.getByText('Nothing planned — drop a place or a note here'),
    ).toBeDefined()
    expect(screen.getByText('0 stops')).toBeDefined()
  })

  it('renders notes and stops as one list, in the order it is given', () => {
    const { container } = render(
      <Harness>
        <DaySection day={DAY} categoryFor={categoryFor} />
      </Harness>,
    )

    const list = container.querySelectorAll(
      '[data-planner-note], [data-planner-item]',
    )
    expect(
      [...list].map(
        (entry) =>
          entry.getAttribute('data-planner-note') ??
          entry.getAttribute('data-planner-place'),
      ),
    ).toEqual(['n1', 'p-sensoji', 'p-skytree', 'p-unmapped'])
  })

  it('does not call a day of notes empty', () => {
    render(
      <Harness>
        <DaySection day={NOTES_ONLY_DAY} categoryFor={categoryFor} />
      </Harness>,
    )
    expect(
      screen.queryByText('Nothing planned — drop a place or a note here'),
    ).toBeNull()
    expect(screen.getByText('Buy the metro pass at the airport')).toBeDefined()
  })

  it('marks the day header as a pressed toggle when the day is the one being read', async () => {
    const user = userEvent.setup()
    const onFocusDay = vi.fn()
    render(
      <Harness>
        <DaySection
          day={DAY}
          categoryFor={categoryFor}
          onFocusDay={onFocusDay}
        />
      </Harness>,
    )

    const header = screen.getByRole('button', { pressed: false })
    await user.click(header)
    expect(onFocusDay).toHaveBeenCalledTimes(1)
  })

  it('marks the selected row with aria-current so it is announced, not just tinted', () => {
    render(
      <Harness>
        <DaySection
          day={DAY}
          categoryFor={categoryFor}
          selectedPlaceId="p-skytree"
        />
      </Harness>,
    )
    const current = screen
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-current') === 'true')
    expect(current).toHaveLength(1)
    expect(current[0].getAttribute('aria-label')).toContain('Tokyo Skytree')
  })

  it('reports selection and hover from the row the reader touched', async () => {
    const user = userEvent.setup()
    const onSelectRow = vi.fn()
    const onHoverRow = vi.fn()
    render(
      <Harness>
        <DaySection
          day={DAY}
          categoryFor={categoryFor}
          onSelectRow={onSelectRow}
          onHoverRow={onHoverRow}
        />
      </Harness>,
    )

    const target = screen
      .getAllByRole('button')
      .find((button) =>
        (button.getAttribute('aria-label') ?? '').startsWith('Tokyo Skytree'),
      )
    if (target === undefined) throw new Error('row button not found')

    await user.hover(target)
    expect(onHoverRow.mock.calls.at(-1)?.[1]).toBe(true)

    await user.click(target)
    expect(onSelectRow).toHaveBeenCalledTimes(1)
    expect(onSelectRow.mock.calls[0][0].placeId).toBe('p-skytree')
  })

  it('makes a row inert while its write is in the air without dropping focus', () => {
    render(
      <Harness>
        <DaySection
          day={DAY}
          categoryFor={categoryFor}
          pendingItemIds={new Set(['a-p-sensoji'])}
        />
      </Harness>,
    )
    const handle = screen.getByRole('button', { name: 'Reorder Sensō-ji' })
    // `aria-disabled`, not `disabled`: a keyboard drop leaves the row pending, and
    // a disabled button would take the reader's focus down with it.
    expect(handle.getAttribute('aria-disabled')).toBe('true')
    expect(handle.hasAttribute('disabled')).toBe(false)
    handle.focus()
    expect(document.activeElement).toBe(handle)
  })
})

/* -------------------------------------------------------------------------------------------------
 * Ideas
 * ---------------------------------------------------------------------------------------------- */

describe('IdeasList', () => {
  const noop = (): void => {}

  it('lists the unplanned places with a search box over them', () => {
    render(
      <Harness>
        <IdeasList
          rows={IDEAS}
          total={IDEAS.length}
          categoryFor={categoryFor}
          query=""
          onQueryChange={noop}
        />
      </Harness>,
    )
    expect(
      screen.getByRole('searchbox', { name: "Search this trip's places" }),
    ).toBeDefined()
    expect(screen.getAllByRole('button', { name: /^Reorder/ })).toHaveLength(2)
  })

  it('reports the query as the screen types it', async () => {
    const user = userEvent.setup()
    const onQueryChange = vi.fn()
    render(
      <Harness>
        <IdeasList
          rows={IDEAS}
          total={IDEAS.length}
          categoryFor={categoryFor}
          query=""
          onQueryChange={onQueryChange}
        />
      </Harness>,
    )

    await user.type(screen.getByRole('searchbox'), 'shr')
    expect(onQueryChange).toHaveBeenCalled()
  })

  it('tells "nothing here" apart from "nothing matches"', () => {
    const { unmount } = render(
      <Harness>
        <IdeasList
          rows={[]}
          total={0}
          categoryFor={categoryFor}
          query=""
          onQueryChange={noop}
        />
      </Harness>,
    )
    expect(screen.getByText('No ideas waiting')).toBeDefined()
    unmount()

    render(
      <Harness>
        <IdeasList
          rows={[]}
          total={7}
          categoryFor={categoryFor}
          query="zzz"
          onQueryChange={noop}
        />
      </Harness>,
    )
    expect(screen.getByText('Nothing matches')).toBeDefined()
  })

  it('draws no stop numeral in the ideas column — an idea has no position', () => {
    render(
      <Harness>
        <IdeasList
          rows={IDEAS}
          total={IDEAS.length}
          categoryFor={categoryFor}
          query=""
          onQueryChange={noop}
        />
      </Harness>,
    )
    const label = screen
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? '')
      .find((entry) => entry.startsWith('Ichiran'))
    expect(label).toContain('not scheduled')
    expect(label).not.toContain('stop 1')
  })
})

/* -------------------------------------------------------------------------------------------------
 * Visited stops
 * ---------------------------------------------------------------------------------------------- */

/**
 * The mark belongs to the place, so every row of it says so: in a day, in the ideas column,
 * on each day the place is on. The row reads `row.visited` and takes no prop for it.
 */
describe('a visited stop', () => {
  const noop = (): void => {}

  /** A day holding exactly these rows, in order. */
  function dayOf(rows: ReadonlyArray<PlannerRow>, dayId = 'd1'): PlannerDay {
    return {
      ...DAY,
      dayId,
      stays: [],
      ...sequence(rows.map((entry) => ({ kind: 'stop', row: entry }))),
    }
  }

  function mountDay(day: PlannerDay) {
    return render(
      <Harness>
        <DaySection day={day} categoryFor={categoryFor} />
      </Harness>,
    )
  }

  /** The row's main button, found by the stop's name. */
  function mainButton(name: string): HTMLElement {
    const button = screen
      .getAllByRole('button')
      .find((entry) => (entry.getAttribute('aria-label') ?? '').startsWith(name))
    if (button === undefined) throw new Error(`no row button for ${name}`)
    return button
  }

  it('says so in the day list, in the row and in the name of its button', () => {
    mountDay(dayOf([row({ placeId: 'p-sensoji', visited: true })]))

    const button = mainButton('Sensō-ji')
    expect(within(button).getByText('Visited')).toBeDefined()
    expect(button.getAttribute('aria-label')).toContain('Visited')
  })

  it('says nothing when the place is not visited', () => {
    mountDay(dayOf([row({ placeId: 'p-sensoji' })]))

    expect(screen.queryByText('Visited')).toBeNull()
    expect(mainButton('Sensō-ji').getAttribute('aria-label')).not.toContain(
      'isited',
    )
    expect(screen.queryByText(/not visited/i)).toBeNull()
  })

  it('still shows the badge when the row has no duration, rating or booking', () => {
    mountDay(
      dayOf([
        row({
          placeId: 'p-bare',
          duration: null,
          rating: null,
          reservationStatus: 'none',
          visited: true,
        }),
      ]),
    )

    expect(within(mainButton('Sensō-ji')).getByText('Visited')).toBeDefined()
  })

  it('shows it next to the booking state rather than instead of it', () => {
    mountDay(
      dayOf([
        row({
          placeId: 'p-sensoji',
          reservationStatus: 'confirmed',
          visited: true,
        }),
      ]),
    )

    const button = mainButton('Sensō-ji')
    expect(within(button).getByText('Visited')).toBeDefined()
    expect(within(button).getByText('Booked')).toBeDefined()
  })

  it('says it on every day the place is on', () => {
    const twice = [
      row({ placeId: 'p-sensoji', itemId: 'a-1', visited: true }),
      row({ placeId: 'p-sensoji', itemId: 'a-2', dayNumber: 2, visited: true }),
    ]
    render(
      <Harness>
        <DaySection day={dayOf([twice[0]], 'd1')} categoryFor={categoryFor} />
        <DaySection
          day={{ ...dayOf([twice[1]], 'd2'), dayNumber: 2 }}
          categoryFor={categoryFor}
        />
      </Harness>,
    )

    expect(screen.getAllByText('Visited')).toHaveLength(2)
  })

  it('says it in the ideas column too', () => {
    const rows = [
      row({
        placeId: 'p-ichiran',
        itemId: ideaItemId('p-ichiran'),
        assignmentId: null,
        name: 'Ichiran Shibuya',
        dayNumber: null,
        visited: true,
      }),
      row({
        placeId: 'p-kinkaku',
        itemId: ideaItemId('p-kinkaku'),
        assignmentId: null,
        name: 'Kinkaku-ji',
        dayNumber: null,
      }),
    ]
    render(
      <Harness>
        <IdeasList
          rows={rows}
          total={rows.length}
          categoryFor={categoryFor}
          query=""
          onQueryChange={noop}
        />
      </Harness>,
    )

    expect(within(mainButton('Ichiran')).getByText('Visited')).toBeDefined()
    expect(within(mainButton('Kinkaku')).queryByText('Visited')).toBeNull()
    expect(screen.getAllByText('Visited')).toHaveLength(1)
  })

  it('draws the visible text and the name from the same words, and keeps one tab stop', () => {
    mountDay(dayOf([row({ placeId: 'p-sensoji', visited: true })]))

    const button = mainButton('Sensō-ji')
    const badge = within(button).getByText('Visited')
    expect(button.getAttribute('aria-label')).toContain(badge.textContent)
    // The check glyph is for the eye only: the word is what carries the meaning.
    expect(badge.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    // A badge is not a control: the row still has its drag handle and its main button.
    expect(button.querySelectorAll('button, a, [tabindex]')).toHaveLength(0)
  })
})

/* -------------------------------------------------------------------------------------------------
 * Rail shell
 * ---------------------------------------------------------------------------------------------- */

describe('PlannerRail', () => {
  it('renders its label, count, toolbar, body and footer', () => {
    render(
      <PlannerRail
        side="left"
        label="Itinerary"
        meta="38"
        collapsed={false}
        onCollapsedChange={() => {}}
        toolbar={<button type="button">Add a place</button>}
        footer={<p>38 stops · 12 days</p>}
      >
        <p>Day one</p>
      </PlannerRail>,
    )

    expect(screen.getByRole('heading', { name: 'Itinerary' })).toBeDefined()
    expect(screen.getByText('38')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Add a place' })).toBeDefined()
    expect(screen.getByText('Day one')).toBeDefined()
    expect(screen.getByText('38 stops · 12 days')).toBeDefined()
  })

  /**
   * The summary card at the foot of the itinerary rail sits *beside* the scroll
   * area, never over it, and the scroll area ends with a fold that reserves exactly
   * the room the last row needs to clear the card. Asserted structurally because
   * jsdom has no layout to measure: the card is a sibling of the scrollport rather
   * than an overlay inside it, the scrollport's last child is the reserved space,
   * and the fade drawn over that space is the same height by construction — both
   * read `--rail-fold`, which the panel declares once.
   */
  it('keeps its summary card out of the scroll area and reserves the fold', () => {
    const { container } = render(
      <PlannerRail
        side="left"
        label="Itinerary"
        collapsed={false}
        onCollapsedChange={() => {}}
        footer={<p>38 stops · 12 days · 360 km between stops</p>}
      >
        <p>Day one</p>
      </PlannerRail>,
    )

    const body = container.querySelector('.overflow-y-auto')
    if (body === null) throw new Error('no scroll body')
    const card = screen.getByText('38 stops · 12 days · 360 km between stops')

    expect(body.contains(card)).toBe(false)
    expect(body.parentElement).toBe(card.parentElement?.parentElement)

    const spacer = body.lastElementChild
    expect(spacer?.hasAttribute('data-rail-fold')).toBe(true)
    expect(spacer?.className).toContain('h-(--rail-fold)')
    expect(spacer?.getAttribute('aria-hidden')).toBe('true')

    // The fade belongs to the card, so it lands at the fold whatever the scroll
    // position is — and covers only empty space once the list has run out.
    const foot = card.parentElement
    const fade = foot?.firstElementChild
    expect(fade?.className).toContain('h-(--rail-fold)')
    expect(fade?.className).toContain('bottom-full')
    expect(fade?.className).toContain('pointer-events-none')

    const panel = container.querySelector('[style*="--rail-fold"]')
    expect(panel).not.toBeNull()
  })

  it('draws no fold where there is no card to clear', () => {
    const { container } = render(
      <PlannerRail
        side="right"
        label="Places"
        collapsed={false}
        onCollapsedChange={() => {}}
      >
        <p>Ichiran Shibuya</p>
      </PlannerRail>,
    )

    expect(container.querySelector('[data-rail-fold]')).toBeNull()
  })

  it('collapses to a labelled tab that still carries its count', async () => {
    const user = userEvent.setup()
    const onCollapsedChange = vi.fn()
    const { rerender } = render(
      <PlannerRail
        side="left"
        label="Itinerary"
        meta="38"
        collapsed={false}
        onCollapsedChange={onCollapsedChange}
      >
        <p>Day one</p>
      </PlannerRail>,
    )

    await user.click(
      screen.getByRole('button', { name: 'Hide the Itinerary panel' }),
    )
    expect(onCollapsedChange).toHaveBeenCalledWith(true)

    rerender(
      <PlannerRail
        side="left"
        label="Itinerary"
        meta="38"
        collapsed
        onCollapsedChange={onCollapsedChange}
      >
        <p>Day one</p>
      </PlannerRail>,
    )

    // Folded away, but the reader can still see what it is and how much is in it.
    expect(screen.getByText('Itinerary')).toBeDefined()
    expect(screen.getByText('38')).toBeDefined()
    expect(screen.queryByText('Day one')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Show the Itinerary panel' }),
    ).toBeDefined()
  })
})

/* -------------------------------------------------------------------------------------------------
 * Drag preview
 * ---------------------------------------------------------------------------------------------- */

describe('DragPreview', () => {
  it('shows what is being held, and nothing a screen reader has to hear twice', () => {
    const { container } = render(
      <DragPreview row={IDEAS[0]} category={categoryFor('c-food')} />,
    )
    expect(screen.getByText('Ichiran Shibuya')).toBeDefined()
    expect(screen.getByText('Shibuya')).toBeDefined()
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe(
      'true',
    )
  })

  it('falls back to the category when a place has no address', () => {
    render(
      <DragPreview
        row={row({ placeId: 'p-x', location: null, categoryId: 'c-food' })}
        category={categoryFor('c-food')}
      />,
    )
    expect(screen.getByText('Food')).toBeDefined()
  })
})

describe('a day that carries a journey', () => {
  const DEPARTING: PlannerTransport = {
    itemId: legItemId('transport', 'd1', 't1'),
    kind: 'transport',
    id: 't1',
    dayId: 'd1',
    part: 'departing',
    phase: null,
    mode: 'train',
    status: 'confirmed',
    serviceNumber: 'Nozomi 21',
    fromName: 'Tokyo',
    toName: 'Kyoto',
    time: '09:00 – 12:30',
    price: null,
    position: 0.5,
  }

  /** A stop, then the journey, then a note — the three kinds in one sequence. */
  const day: PlannerDay = {
    ...DAY,
    ...sequence([
      { kind: 'stop', row: row({ placeId: 'p-sensoji' }) },
      { kind: 'transport', transport: DEPARTING },
      { kind: 'note', note: NOTE },
    ]),
  }

  it('renders it between the stop and the note, and leaves the stop count alone', () => {
    const { container } = render(
      <DndContext>
        <DaySection day={day} categoryFor={categoryFor} />
      </DndContext>,
    )

    const items = Array.from(
      container.querySelectorAll('li[data-planner-item]'),
    )
    expect(items.map((item) => item.getAttribute('data-planner-item'))).toEqual(
      ['a-p-sensoji', DEPARTING.itemId],
    )
    expect(items[1].getAttribute('data-part')).toBe('planner-transport-row')
    // One stop on the day, whatever else shares the sequence with it.
    expect(day.rows).toHaveLength(1)
  })

  it('offers the departing row a handle', () => {
    render(
      <DndContext>
        <DaySection day={day} categoryFor={categoryFor} />
      </DndContext>,
    )
    expect(
      screen.getByRole('button', { name: 'Reorder, Tokyo to Kyoto' }),
    ).toBeDefined()
  })

  it('offers the travelling row none, and says which part of the journey it is', () => {
    const crossing: PlannerDay = {
      ...DAY,
      ...sequence([
        {
          kind: 'transport',
          transport: {
            ...DEPARTING,
            itemId: legItemId('transport', 'd2', 't1'),
            part: 'travelling',
            phase: 'trips.plan.transport.phase.journey.travelling',
            time: null,
          },
        },
      ]),
    }
    render(
      <DndContext>
        <DaySection day={crossing} categoryFor={categoryFor} />
      </DndContext>,
    )
    expect(
      screen.queryByRole('button', { name: 'Reorder, Tokyo to Kyoto' }),
    ).toBeNull()
    expect(screen.getByText('Under way')).toBeDefined()
  })

  it('follows the pointer as a journey, not as a place', () => {
    const { container } = render(<DragPreview transport={DEPARTING} />)

    expect(container.firstElementChild?.getAttribute('data-drag-preview')).toBe(
      'transport',
    )
    expect(screen.getByText('Tokyo → Kyoto')).toBeDefined()
    expect(screen.getByText('09:00 – 12:30')).toBeDefined()
  })
})

describe('resizable rails', () => {
  it('exposes a named separator and clamps keyboard widths at either edge', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <PlannerRail
        side="right"
        label="Places"
        collapsed={false}
        onCollapsedChange={() => {}}
        resize={{
          width: 392,
          min: 280,
          max: 400,
          step: 16,
          label: 'Resize places',
          onChange,
        }}
      >
        body
      </PlannerRail>,
    )
    const handle = screen.getByRole('separator', { name: 'Resize places' })
    expect(handle.getAttribute('aria-valuenow')).toBe('392')
    expect(handle.getAttribute('aria-valuemin')).toBe('280')
    expect(handle.getAttribute('aria-valuemax')).toBe('400')
    handle.focus()
    await user.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith(400)
    await user.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith(376)
    await user.keyboard('{Home}')
    expect(onChange).toHaveBeenLastCalledWith(280)
    await user.keyboard('{End}')
    expect(onChange).toHaveBeenLastCalledWith(400)
  })
})

describe('day folding', () => {
  it('folds independently from focus and keeps a controlled accessible button', async () => {
    const user = userEvent.setup()
    const focus = vi.fn()
    const expand = vi.fn()
    const ui = (expanded: boolean) => (
      <DndContext>
        <DaySection
          day={DAY}
          categoryFor={categoryFor}
          expanded={expanded}
          onExpandedChange={expand}
          onFocusDay={focus}
        />
      </DndContext>
    )
    const view = render(ui(true))
    const toggle = screen.getByRole('button', {
      name: `Expand or collapse ${DAY.title}`,
    })
    const id = toggle.getAttribute('aria-controls') ?? ''
    expect(document.getElementById(id)?.hidden).toBe(false)
    await user.click(toggle)
    expect(expand).toHaveBeenCalledWith(false)
    expect(focus).not.toHaveBeenCalled()
    view.rerender(ui(false))
    expect(document.getElementById(id)?.hidden).toBe(true)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('single-pointer rail sizing', () => {
  it('allows clicks to reach both width endpoints without dragging', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const ui = (width: number) => (
      <PlannerRail
        side="left"
        label="Itinerary"
        collapsed={false}
        onCollapsedChange={() => {}}
        resize={{
          width,
          min: 280,
          max: 400,
          step: 16,
          label: 'Resize itinerary',
          onChange,
        }}
      >
        body
      </PlannerRail>
    )
    const view = render(ui(392))
    await user.click(screen.getByRole('button', { name: 'Widen Itinerary' }))
    expect(onChange).toHaveBeenLastCalledWith(400)
    view.rerender(ui(288))
    await user.click(screen.getByRole('button', { name: 'Narrow Itinerary' }))
    expect(onChange).toHaveBeenLastCalledWith(280)
    view.rerender(ui(280))
    expect(
      screen
        .getByRole('button', { name: 'Narrow Itinerary' })
        .hasAttribute('disabled'),
    ).toBe(true)
    view.rerender(ui(400))
    expect(
      screen
        .getByRole('button', { name: 'Widen Itinerary' })
        .hasAttribute('disabled'),
    ).toBe(true)
  })
})
